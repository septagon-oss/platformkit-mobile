import assert from "node:assert/strict";
import test from "node:test";
import { heldWrite } from "../src/core/outbox";
import { createApi } from "../src/effects/api";
import { createOutbox } from "../src/effects/outbox";
import { clock, fakeOutboxStore, mint } from "./fakes/store";

test("retry on the later of two held updates to one row never lets the earlier one land last", async () => {
  const pending = fakeOutboxStore();
  for (const [id, title] of [
    ["earlier", "Morning count"],
    ["later", "Evening count"],
  ]) {
    pending.raw(
      heldWrite(
        {
          kind: "update",
          resourceKey: "note/note",
          path: "/api/v1/note/notes/42",
          body: { title },
        },
        id!,
        clock().now(),
      ),
      "https://depot.test",
      "grace",
    );
  }
  const completed = Promise.withResolvers<void>();
  const sent: string[] = [];
  let titleOnServer = "Unchanged";
  const api = createApi("https://depot.test", (async (_input, init) => {
    const { title } = JSON.parse(String(init?.body)) as { title: string };
    sent.push(title);
    titleOnServer = title;
    return new Response(JSON.stringify({ id: "42", title }), { status: 200 });
  }) as typeof fetch);
  const outbox = createOutbox({
    store: pending.store,
    api,
    clock: clock(),
    mint: mint(),
    scope: () => ({ server: "https://depot.test", userId: "grace" }),
    notice: () => {
      if (pending.rows.length === 0) completed.resolve();
    },
  });

  // Both rows are queued and no drain is running (the last pass ended on a dead
  // network, or the device's hint still says offline). Home offers Retry on
  // every queued row; the person presses it on the later one. Whether Retry
  // there sends from the head or refuses, the queue then drains what it holds.
  await outbox.retry("later").catch(() => undefined);
  await outbox.drain({ force: true });
  await completed.promise;

  assert.deepEqual(
    { sent, titleOnServer },
    { sent: ["Morning count", "Evening count"], titleOnServer: "Evening count" },
    "held updates reach the server in the order they were made, whichever row Retry was pressed on",
  );
});
