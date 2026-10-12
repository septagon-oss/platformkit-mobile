// Rules this file holds.
// A write the phone kept goes back on a wire as the request it was: a delete carries no body at
// all, and a write with a body carries the document the form produced — an object, never the text
// of one. Sending, refusing and sending again never rewrite what is kept on the device: the row
// holds the same characters until it goes.
import assert from "node:assert/strict";
import test from "node:test";
import { createApi } from "../src/effects/api";
import { heldWrite } from "../src/core/outbox";
import { createOutbox } from "../src/effects/outbox";
import { fakeOutboxStore, mint } from "./fakes/store";

const ada = { server: "https://acme.test", userId: "ada" };

function queue(online: { value: boolean }, answer: (path: string, body: unknown) => Response) {
  const seen: { method: string; path: string; body: unknown }[] = [];
  const store = fakeOutboxStore();
  const outbox = createOutbox({
    store: store.store,
    api: createApi("https://acme.test", (async (input, init) => {
      const path = new URL(String(input)).pathname;
      // What a caller can check is what an endpoint reads: the document the
      // transport put on the wire, decoded once the way a server decodes it.
      const document = init?.body === undefined ? undefined : JSON.parse(String(init.body));
      seen.push({ method: String(init?.method), path, body: document });
      return answer(path, document);
    }) as typeof fetch),
    clock: { now: () => "2026-10-08T10:00:00.000Z" },
    mint: mint(),
    scope: () => ada,
    reached: () => online.value,
  });
  return { outbox, store, seen };
}

test("a held delete is replayed as a delete that carries no body", async () => {
  const online = { value: false };
  const { outbox, seen } = queue(online, () => new Response(null, { status: 204 }));
  const answer = await outbox.submit({
    kind: "delete",
    resourceKey: "note/note",
    path: "/api/v1/note/notes/gone-note",
  });
  assert.equal(answer.sent, false);
  if (answer.sent) return;

  online.value = true;
  await outbox.drain();

  assert.deepEqual(seen, [
    { method: "DELETE", path: "/api/v1/note/notes/gone-note", body: undefined },
  ]);
  assert.deepEqual(await outbox.list(), [], "the row went when the server answered it");
});

test("a refused send keeps the person's own characters and the next send carries them again", async () => {
  const online = { value: false };
  const values = { title: 'Dîner — "quoted"', amount: 1705, tags: ["field", "ü"], revision: 7 };
  const kept = JSON.stringify(values);
  let accepts = false;
  const { outbox, store, seen } = queue(online, () =>
    accepts
      ? new Response(JSON.stringify({ id: "n-1", revision: 8 }), { status: 200 })
      : new Response(JSON.stringify({ detail: "That row moved." }), { status: 409 }),
  );
  const answer = await outbox.submit({
    kind: "update",
    resourceKey: "note/note",
    path: "/api/v1/note/notes/n-1",
    body: values,
  });
  assert.equal(answer.sent, false);
  if (answer.sent) return;
  assert.equal(
    (await store.store.list(ada))[0]?.body,
    kept,
    "the row holds the form's own JSON text",
  );

  online.value = true;
  await outbox.drain();
  assert.deepEqual(seen, [{ method: "PATCH", path: "/api/v1/note/notes/n-1", body: values }]);
  assert.equal((await store.store.list(ada))[0]?.body, kept, "a refused send rewrote nothing");
  assert.equal((await store.store.list(ada))[0]?.state, "refused");

  accepts = true;
  await outbox.retry((await store.store.list(ada))[0]!.id);
  assert.deepEqual(seen[1], { method: "PATCH", path: "/api/v1/note/notes/n-1", body: values });
  assert.deepEqual(await outbox.list(), [], "the server's answer to the retry took the row away");
});

test("a row this phone cannot read is refused by the name of what is wrong and stays for the person", async () => {
  const online = { value: true };
  const { outbox, store, seen } = queue(online, () => new Response(null, { status: 204 }));
  const kept = heldWrite(
    {
      kind: "create",
      resourceKey: "note/note",
      path: "/api/v1/note/notes",
      body: { title: "fine" },
    },
    "unreadable-row",
    "2026-10-08T10:00:00.000Z",
  );
  // Not this phone's own writing: a disk that went bad, or a row this version was
  // not built to read. It is neither a network that never took the request nor a
  // reason to keep the row queued where nothing can ever send it.
  store.raw({ ...kept, body: "{title: unclosed" });

  await outbox.drain();
  assert.deepEqual(seen, [], "a body that cannot be decoded never goes on a wire");
  const row = (await store.store.list(ada))[0]!;
  assert.equal(row.state, "refused");
  assert.match(row.refusal?.detail ?? "", /not something it can read/);

  const still = await outbox.retry(row.id);
  assert.equal(still.length, 1, "the row stays, named, for the person to discard");
  assert.deepEqual(seen, []);
});
