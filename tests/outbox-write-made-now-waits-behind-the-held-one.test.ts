// One queue runs one write at a time, whichever button asked for it. A write the
// person makes now is a write to the same queue that holds an older one, so it
// waits behind the older write's answer instead of landing on top of it: the held
// PATCH still on a wire is the older statement about the same row. The queue is
// draining by itself here — a Discard offered it the turn, as the Home screen's
// Discard does — so nothing the person does next may slip past the request that
// is already waiting for its answer.
import assert from "node:assert/strict";
import test from "node:test";
import { heldWrite } from "../src/core/outbox";
import { createApi } from "../src/effects/api";
import { createOutbox } from "../src/effects/outbox";
import { clock, fakeOutboxStore, mint } from "./fakes/store";

const PATH = "/api/v1/note/notes/7";

/**
 * phone is a device that holds one older update to a row, whose answer does not
 * come back until the test releases it, plus one write the person means to throw
 * away. `sent` is what left the phone, in order; `server` is what the row says now.
 */
function phone() {
  const pending = fakeOutboxStore();
  const seed = (id: string, title: string, path: string) =>
    pending.raw(
      heldWrite(
        { kind: "update", resourceKey: "note/note", path, body: { title } },
        id,
        clock().now(),
      ),
    );
  seed("held-first", "Held edit", PATH);
  seed("unwanted", "Unwanted edit", "/api/v1/note/notes/8");
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const sent: string[] = [];
  let titleOnServer = "Original";
  const api = createApi("https://acme.test", (async (_input, init) => {
    const { title } = JSON.parse(String(init?.body)) as { title: string };
    sent.push(title);
    if (title === "Held edit") {
      started.resolve();
      await release.promise;
    }
    titleOnServer = title;
    return new Response(JSON.stringify({ id: "7", title }), { status: 200 });
  }) as typeof fetch);
  const outbox = createOutbox({
    store: pending.store,
    api,
    clock: clock(),
    mint: mint(),
    scope: () => ({ server: "https://acme.test", userId: "ada" }),
  });
  return { outbox, started, release, sent, server: () => titleOnServer };
}

test("a write the person makes now waits for the held write to the same row", async () => {
  const { outbox, started, release, sent, server } = phone();
  // Discarding one write gives the queue its turn, exactly as it is offered on
  // Home; the older update to /7 is on a wire and unanswered.
  await outbox.discard("unwanted");
  await started.promise;
  const written = outbox.submit({
    kind: "update",
    resourceKey: "note/note",
    path: PATH,
    body: { title: "Later edit" },
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(sent, ["Held edit"], "the newer write has not gone while the older awaits");
  release.resolve();
  const answer = await written;
  assert.equal(answer.sent, true, "the write the person made goes the moment the queue is clear");
  assert.deepEqual(sent, ["Held edit", "Later edit"], "one at a time, in the order they were made");
  assert.equal(server(), "Later edit", "the older edit does not overwrite the newer one");
  assert.deepEqual(await outbox.list(), [], "nothing is left owed on the phone");
});
