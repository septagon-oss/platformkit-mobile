// A write the transport refused before any header arrived may still have reached
// the server: React Native's fetch cannot tell the two apart. The only thing that
// lets the server spot the replay as a repeat is that the first attempt and the
// replay carry the same Idempotency-Key, so the key has to exist before the first
// attempt leaves the phone, not be minted when the write is held afterwards.
import assert from "node:assert/strict";
import test from "node:test";
import { createApi } from "../src/effects/api";
import { createOutbox } from "../src/effects/outbox";
import { clock, fakeOutboxStore, mint } from "./fakes/store";

const SERVER = "https://acme.test";
const PATH = "/api/v1/note/notes";

test("a write held after its first attempt failed is replayed with the key that attempt carried", async () => {
  const keys: (string | undefined)[] = [];
  let calls = 0;
  const fetchImpl = (async (_input, init) => {
    keys.push((init?.headers as Record<string, string> | undefined)?.["Idempotency-Key"]);
    calls += 1;
    if (calls === 1) throw new TypeError("Network request failed");
    return new Response(JSON.stringify({ id: "7", title: "Field note" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  const outbox = createOutbox({
    store: fakeOutboxStore().store,
    api: createApi(SERVER, fetchImpl, {
      token: "pk_live_on-the-wire-only",
      id: "00000000-0000-4000-8000-000000000021",
    }),
    clock: clock(),
    mint: mint(),
    scope: () => ({ server: SERVER, userId: "ada" }),
  });

  const answer = await outbox.submit({
    kind: "create",
    resourceKey: "note/note",
    path: PATH,
    body: { title: "Field note" },
  });
  assert.equal(answer.sent, false, "the first attempt failed, so the write is held");
  await outbox.drain();

  assert.equal(keys.length, 2, "one first attempt and one replay");
  assert.notEqual(keys[0], undefined, "the first attempt names the write it is");
  assert.equal(keys[1], keys[0], "the replay names the same write as the first attempt");
});
