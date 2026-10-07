// A list at a documented path goes through its generated operation without losing what the screen
// asked for: the sort and every repeated filter reach the server as written, and the answer is still
// held to the operation's whole envelope, so a page without limit is refused naming limit.
import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createApi } from "../src/effects/api";

const entry = {
  module: "task",
  entity: "task",
  path: "/api/v1/task/tasks",
  fields: [],
  immutable: [],
  commands: [],
  writable: true,
  singleton: false,
};

function answering(body: unknown) {
  const urls: string[] = [];
  const api = createApi("https://lists.test", (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch);
  return { api, urls };
}

test("a documented list sends its sort and every repeated filter", async () => {
  const { api, urls } = answering({
    items: [{ title: "Replace valve" }],
    total: 7,
    limit: 4,
    offset: 4,
  });
  const page = await api.list(entry, {
    offset: 4,
    limit: 4,
    sort: "-dueAt",
    filters: ["status:open", "owner:r&d team"],
  });
  assert.deepEqual(page, { items: [{ title: "Replace valve" }], total: 7 });
  assert.equal(urls.length, 1);
  const sent = new URL(urls[0]!);
  assert.equal(sent.pathname, "/api/v1/task/tasks");
  assert.equal(sent.searchParams.get("sort"), "-dueAt");
  assert.deepEqual(sent.searchParams.getAll("filter"), ["status:open", "owner:r&d team"]);
  assert.equal(sent.searchParams.get("limit"), "4");
  assert.equal(sent.searchParams.get("offset"), "4");
});

test("a documented list answer without limit is refused naming limit", async () => {
  const { api } = answering({ items: [{ title: "Replace valve" }], total: 7, offset: 0 });
  await assert.rejects(api.list(entry, { filters: ["status:open"] }), (error: unknown) => {
    assert.ok(error instanceof ApiError, `expected an ApiError, got ${String(error)}`);
    assert.equal(error.status, 200);
    assert.match(error.detail, /\/api\/v1\/task\/tasks\?/);
    assert.match(error.detail, /\blimit\b/);
    return true;
  });
});
