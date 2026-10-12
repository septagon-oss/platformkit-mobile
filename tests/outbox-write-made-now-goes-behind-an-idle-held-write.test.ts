import assert from "node:assert/strict";
import test from "node:test";
import { heldWrite } from "../src/core/outbox";
import { createApi } from "../src/effects/api";
import { createOutbox } from "../src/effects/outbox";
import { clock, fakeOutboxStore, mint } from "./fakes/store";

test("a write made now to a row with an older held update is never overwritten by it", async () => {
  const pending = fakeOutboxStore();
  pending.raw(
    heldWrite(
      {
        kind: "update",
        resourceKey: "note/note",
        path: "/api/v1/note/notes/42",
        body: { title: "Morning count" },
      },
      "earlier",
      clock().now(),
    ),
    "https://depot.test",
    "grace",
  );
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
  });

  // The held update is queued and no drain is running (the last pass ended on a
  // dead network). The person edits the same record again and the network is back.
  await outbox
    .submit({
      kind: "update",
      resourceKey: "note/note",
      path: "/api/v1/note/notes/42",
      body: { title: "Evening count" },
    })
    .catch(() => undefined);
  await outbox.drain({ force: true });

  assert.equal(
    titleOnServer,
    "Evening count",
    "the record ends with the edit the person made last, whatever left the phone",
  );
  assert.equal(sent.at(-1), "Evening count", "the older held edit does not land after the newer");
});
