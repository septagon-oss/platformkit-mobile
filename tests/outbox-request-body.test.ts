import assert from "node:assert/strict";
import test from "node:test";
import { createApi } from "../src/effects/api";
import { createOutbox } from "../src/effects/outbox";
import type { WriteKind } from "../src/core/outbox";
import { clock, fakeOutboxStore, mint } from "./fakes/store";

for (const kind of [
  "create",
  "update",
  "replace",
  "command",
] as const satisfies readonly WriteKind[]) {
  test(`a held ${kind} sends the original JSON object on drain and Retry`, async () => {
    let online = false;
    const bodies: unknown[] = [];
    const values = { title: "Draft", amount: 1705, tags: ["field"], revision: 7 };
    const outbox = createOutbox({
      store: fakeOutboxStore().store,
      api: createApi("https://acme.test", (async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ detail: "conflict" }), { status: 409 });
      }) as typeof fetch),
      clock: clock(),
      mint: mint(),
      scope: () => ({ server: "https://acme.test", userId: "ada" }),
      reached: () => online,
    });
    const answer = await outbox.submit({
      kind,
      resourceKey: "note/note",
      path: "/api/v1/note/notes",
      body: values,
    });
    assert.equal(answer.sent, false);
    if (answer.sent) return;
    online = true;
    await outbox.drain();
    await outbox.retry(answer.item.id);
    assert.deepEqual(bodies, [values, values]);
  });
}
