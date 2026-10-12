// Two held updates to one record are two statements about one row, and the older
// one must reach the server first whatever the person presses. So a Retry on the
// newer of the two sends nothing newer while the older is still owed: the queue
// runs from its head, the older write is tried, and when the server is still not
// taking it the newer one stays on the phone behind it. And a write made while the
// phone is online, to a record whose older update a 4xx left refused, waits behind
// that refused row and lands after it once Retry gets the older one through.
import assert from "node:assert/strict";
import test from "node:test";
import { heldWrite } from "../src/core/outbox";
import { createApi } from "../src/effects/api";
import { createOutbox } from "../src/effects/outbox";
import { clock, fakeOutboxStore, heldRow, mint } from "./fakes/store";

const PATH = "/api/v1/inventory/items/17";

const update = (title: string) => ({
  kind: "update" as const,
  resourceKey: "inventory/item",
  path: PATH,
  body: { title },
});

/**
 * phone is a device signed in as one person, whose server answers each update
 * with the row unless `refuse` says otherwise. `sent` is what left the phone in
 * order; `server` is the row's title as the server last took it.
 */
function phone(refuse: (title: string) => Response | undefined) {
  const pending = fakeOutboxStore();
  const sent: string[] = [];
  let titleOnServer = "Original stock";
  const api = createApi("https://warehouse.test", (async (_input, init) => {
    const { title } = JSON.parse(String(init?.body)) as { title: string };
    sent.push(title);
    const refused = refuse(title);
    if (refused) return refused;
    titleOnServer = title;
    return new Response(JSON.stringify({ id: "17", title }), { status: 200 });
  }) as typeof fetch);
  const outbox = createOutbox({
    store: pending.store,
    api,
    clock: clock(),
    mint: mint(),
    scope: () => ({ server: "https://warehouse.test", userId: "morgan" }),
  });
  const seed = (id: string, title: string, over = {}) =>
    pending.raw(
      heldRow(heldWrite(update(title), id, clock().now()), over),
      "https://warehouse.test",
      "morgan",
    );
  return { outbox, seed, sent, server: () => titleOnServer };
}

test("a Retry on the newer of two held updates sends nothing newer while the older is still owed", async () => {
  const { outbox, seed, sent } = phone((title) =>
    title === "Opening stock"
      ? new Response(JSON.stringify({ detail: "Temporarily unavailable" }), { status: 503 })
      : undefined,
  );
  seed("older", "Opening stock");
  seed("newer", "Closing stock");

  const after = await outbox.retry("newer").catch(() => outbox.list());

  assert.deepEqual(sent, ["Opening stock"], "only the older write was tried, and it did not go");
  assert.deepEqual(
    after.map((item) => [item.id, item.state]),
    [
      ["older", "queued"],
      ["newer", "queued"],
    ],
    "both updates stay on the phone, the older still ahead of the newer",
  );
});

test("a write made online behind a refused update to its record lands after it once Retry gets the older through", async () => {
  const { outbox, seed, sent, server } = phone(() => undefined);
  seed("older", "Opening stock", {
    state: "refused",
    attempt: 1,
    refusal: { status: 422, detail: "Title too long", fields: {} },
  });

  await outbox.submit(update("Closing stock")).catch(() => undefined);
  await outbox.retry("older");
  await outbox.drain({ force: true });

  assert.deepEqual(
    { sent, titleOnServer: server(), held: await outbox.list() },
    { sent: ["Opening stock", "Closing stock"], titleOnServer: "Closing stock", held: [] },
    "the older update lands first and the record ends with the edit the person made last",
  );
});
