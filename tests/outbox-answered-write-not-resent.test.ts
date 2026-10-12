// A write the server already took is never held for a second send: the kernel
// does not yet honour the Idempotency-Key a held write carries, so a second
// POST of a create is a second record. A connection that drops while the
// answer's body is read happened after the server answered.
import assert from "node:assert/strict";
import test from "node:test";
import { createApi } from "../src/effects/api";
import { createOutbox } from "../src/effects/outbox";
import type { Scope } from "../src/core/outbox";
import { clock, fakeOutboxStore, mint } from "./fakes/store";

const SERVER = "https://acme.test";
const SCOPE: Scope = { server: SERVER, userId: "ada" };
const PATH = "/api/v1/note/notes";

type Answer = "offline" | "created" | "cut-off";

function phone(answers: Answer[]) {
  const store = fakeOutboxStore();
  const posted: string[] = [];
  let index = 0;
  const fetchImpl = (async (_input, init) => {
    const answer = answers[Math.min(index, answers.length - 1)]!;
    index += 1;
    if (answer === "offline") throw new TypeError("Network request failed");
    posted.push(String(init?.body));
    if (answer === "cut-off") {
      // The server took the request and answered 201; the connection dropped
      // while its body was being read.
      const response = new Response("", { status: 201 });
      Object.defineProperty(response, "text", {
        value: () => Promise.reject(new TypeError("Network request failed")),
      });
      return response;
    }
    return new Response(JSON.stringify({ id: `n${index}` }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  const outbox = createOutbox({
    store: store.store,
    api: createApi(SERVER, fetchImpl, "pk_session=1", 40),
    clock: clock(),
    mint: mint(),
    scope: () => SCOPE,
  });
  return { outbox, store, posted };
}

test("a write whose answer was cut off after the server took it is not sent again", async () => {
  const { outbox, posted } = phone(["cut-off", "created"]);
  const answer = await outbox
    .submit({ kind: "create", resourceKey: "note/note", path: PATH, body: { title: "Once" } })
    .catch(() => undefined);
  await outbox.drain({ force: true });
  assert.equal(posted.length, 1, `the create went on the wire ${posted.length} times`);
  const queued = (await outbox.list()).filter((item) => item.state === "queued");
  assert.deepEqual(queued, [], "a write the server answered waits to be sent again");
  void answer;
});
