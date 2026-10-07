// A list answer is a page only when its envelope is one: items is an array of rows and total is a
// number. Anything else is refused as an ApiError that names the first wrong path, so a screen shows
// the refusal it shows for any API error instead of drawing a page out of strings.
import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createApi } from "../src/effects/api";

const entry = {
  module: "ticket",
  entity: "ticket",
  path: "/api/v1/ticket/tickets",
  fields: [],
  immutable: [],
  writable: true,
  commands: [],
  singleton: false,
};

function answering(body: string): typeof fetch {
  return (async () =>
    new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

test("a well-formed page is read as a page", async () => {
  const api = createApi("https://acme.test", answering('{"items":[{"id":"t1"}],"total":1}'));
  assert.deepEqual(await api.list(entry), { items: [{ id: "t1" }], total: 1 });
});

test("a list answer whose items and total are strings is refused naming items", async () => {
  const api = createApi("https://acme.test", answering('{"items":"wrong","total":"wrong"}'));
  await assert.rejects(api.list(entry), (error: unknown) => {
    assert.ok(error instanceof ApiError, `expected an ApiError, got ${String(error)}`);
    assert.match(error.detail, /\bitems\b/);
    return true;
  });
});

test("a list answer whose total is not a number is refused naming total", async () => {
  const api = createApi("https://acme.test", answering('{"items":[],"total":"3"}'));
  await assert.rejects(api.list(entry), (error: unknown) => {
    assert.ok(error instanceof ApiError, `expected an ApiError, got ${String(error)}`);
    assert.match(error.detail, /\btotal\b/);
    return true;
  });
});
