// Waiting behind the queue is a rule about one record, not about the queue: two
// writes to one address are statements about the same row, and two writes to two
// addresses are statements about different rows. So a submission that finds an
// older write still queued goes at once when that write is about another record,
// and a create goes even when the blocked write names the same collection, because
// a create names a collection rather than a record. A phone that held every write
// behind the head of a stalled queue would be refusing to write while it is
// online, which is the opposite of what the queue is for.
import assert from "node:assert/strict";
import test from "node:test";
import { heldWrite } from "../src/core/outbox";
import { createApi } from "../src/effects/api";
import { createOutbox } from "../src/effects/outbox";
import { clock, fakeOutboxStore, mint } from "./fakes/store";

/**
 * phone is a device whose queue holds one write the server keeps refusing with
 * 503, so that write stays queued and every pass ends at it. A write whose title is
 * in `accepted` is answered with the row it wrote.
 */
function phone(held: { kind: "create" | "update"; path: string }, accepted: readonly string[]) {
  const pending = fakeOutboxStore();
  pending.raw(
    heldWrite(
      { kind: held.kind, resourceKey: "note/note", path: held.path, body: { title: "Held" } },
      "held-first",
      clock().now(),
    ),
    "https://depot.test",
    "grace",
  );
  const sent: string[] = [];
  const api = createApi("https://depot.test", (async (_input, init) => {
    const { title } = JSON.parse(String(init?.body)) as { title: string };
    sent.push(title);
    if (!accepted.includes(title))
      return new Response(JSON.stringify({ detail: "Temporarily unavailable" }), { status: 503 });
    return new Response(JSON.stringify({ id: "1", title }), { status: 200 });
  }) as typeof fetch);
  const outbox = createOutbox({
    store: pending.store,
    api,
    clock: clock(),
    mint: mint(),
    scope: () => ({ server: "https://depot.test", userId: "grace" }),
  });
  return { outbox, pending, sent };
}

test("an update to another row is not held back by an update the server will not take", async () => {
  const { outbox, sent } = phone({ kind: "update", path: "/api/v1/note/notes/7" }, ["Newer row"]);

  const answer = await outbox.submit({
    kind: "update",
    resourceKey: "note/note",
    path: "/api/v1/note/notes/8",
    body: { title: "Newer row" },
  });

  assert.equal(answer.sent, true, "the write the person made now goes while the other is owed");
  const after = await outbox.list();
  assert.deepEqual(
    sent,
    ["Held", "Newer row", "Held"],
    "the queue's turn ends at the owed write, this one goes, and the write that landed asks the queue once more",
  );
  assert.deepEqual(
    after.map((item) => [item.id, item.state]),
    [["held-first", "queued"]],
    "the blocked write stays queued and this one leaves the device",
  );
});

test("a create is not held back by a blocked write to the collection it names", async () => {
  const { outbox } = phone({ kind: "create", path: "/api/v1/note/notes" }, ["Another note"]);

  const answer = await outbox.submit({
    kind: "create",
    resourceKey: "note/note",
    path: "/api/v1/note/notes",
    body: { title: "Another note" },
  });

  assert.equal(answer.sent, true, "two creates are statements about different rows");
  assert.deepEqual(
    (await outbox.list()).map((item) => item.id),
    ["held-first"],
    "the held create is still owed and the new one is written",
  );
});
