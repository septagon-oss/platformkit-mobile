// A write this phone held goes to the server once the server can be reached
// again, without the person finding it and pressing Retry: the next write that
// does reach the server is proof the network is back, and the held one goes
// with it. And a write the server already answered is never held for a second
// send, because the kernel does not yet honour the Idempotency-Key it carries.
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
    api: createApi(
      SERVER,
      fetchImpl,
      { token: "pk_live_1", id: "00000000-0000-4000-8000-000000000021" },
      40,
    ),
    clock: clock(),
    mint: mint(),
    scope: () => SCOPE,
  });
  return { outbox, store, posted };
}

async function settled(until: () => boolean): Promise<void> {
  for (let i = 0; i < 50 && !until(); i += 1) await new Promise((r) => setTimeout(r, 10));
}

test("a held write goes once the next write reaches the server", async () => {
  const { outbox, store, posted } = phone(["offline", "created"]);
  const first = await outbox.submit({
    kind: "create",
    resourceKey: "note/note",
    path: PATH,
    body: { title: "Made offline" },
  });
  assert.equal(first.sent, false, "reachability: the first write was held");
  const second = await outbox.submit({
    kind: "create",
    resourceKey: "note/note",
    path: PATH,
    body: { title: "Made online" },
  });
  assert.equal(second.sent, true, "reachability: the server answers again");
  await settled(() => store.rows.length === 0);
  assert.deepEqual(
    await outbox.list(),
    [],
    "the held write is still on the phone after the server answered",
  );
  assert.ok(posted.some((body) => body.includes("Made offline")));
});
