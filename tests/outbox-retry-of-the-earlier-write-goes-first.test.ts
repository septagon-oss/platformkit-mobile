// A held write's Retry gets that write to the server; it never sends the pressed
// row out of order and it never wedges the queue. So the press on the *older* of
// two held updates to one record is the plain case: that update goes first, the
// queue follows with the newer one, and the record ends with the edit the person
// made last. A cure that drained only from the head of the whole queue, or that
// refused Retry whenever anything was held, would fail here.
import assert from "node:assert/strict";
import test from "node:test";
import { heldWrite } from "../src/core/outbox";
import { createApi } from "../src/effects/api";
import { createOutbox } from "../src/effects/outbox";
import { clock, fakeOutboxStore, mint } from "./fakes/store";

test("a Retry pressed on the earlier of two held updates sends that one first and the queue follows", async () => {
  const pending = fakeOutboxStore();
  for (const [id, title] of [
    ["elder", "First count"],
    ["younger", "Second count"],
  ]) {
    pending.raw(
      heldWrite(
        {
          kind: "update",
          resourceKey: "note/note",
          path: "/api/v1/note/notes/9",
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
    return new Response(JSON.stringify({ id: "9", title }), { status: 200 });
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

  // The older row is the one the person presses, and the queue is idle: the
  // press is what starts it.
  await outbox.retry("elder");
  await completed.promise;

  assert.deepEqual(
    { sent, titleOnServer },
    { sent: ["First count", "Second count"], titleOnServer: "Second count" },
    "the pressed update lands first and the one made after it follows, in the order they were made",
  );
});
