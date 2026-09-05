import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createApi } from "../src/effects/api";

type Call = { url: string; init: RequestInit };
function fakeFetch(
  answers: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>,
) {
  const calls: Call[] = [];
  const f = async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const a = answers.shift()!;
    return new Response(a.body === undefined ? null : JSON.stringify(a.body), {
      status: a.status,
      headers: { "Content-Type": "application/json", ...(a.headers ?? {}) },
    });
  };
  return { fetch: f as unknown as typeof fetch, calls };
}

const entry = {
  module: "note",
  entity: "note",
  path: "/api/v1/note/notes",
  fields: [],
  immutable: [],
  writable: true,
};

test("login keeps the session cookie and sends it back", async () => {
  const { fetch, calls } = fakeFetch([
    { status: 204, headers: { "Set-Cookie": "platformkit_session=abc; Path=/; HttpOnly" } },
    { status: 200, body: { resources: [] } },
  ]);
  const api = createApi("https://acme.test", fetch);
  await api.login("a@acme.test", "pw");
  const c = await api.catalog();
  assert.equal(c.resources.length, 0);
  assert.equal(calls[0]!.url, "https://acme.test/api/v1/auth/login");
  assert.equal(
    (calls[1]!.init.headers as Record<string, string>).Cookie,
    "platformkit_session=abc",
  );
  assert.equal(api.cookie(), "platformkit_session=abc");
});

test("a problem document becomes an ApiError with field errors", async () => {
  const { fetch } = fakeFetch([
    {
      status: 422,
      body: {
        status: 422,
        detail: "crud: invalid: a note needs a title",
        errors: ["title: is required"],
      },
    },
  ]);
  const api = createApi("https://acme.test", fetch);
  await assert.rejects(
    api.create(entry, { title: "" }),
    (e: unknown) =>
      e instanceof ApiError &&
      e.status === 422 &&
      e.fields.title === "is required" &&
      /a note needs a title/.test(e.detail),
  );
});

test("list reads the page envelope", async () => {
  const { fetch, calls } = fakeFetch([
    { status: 200, body: { items: [{ id: "1" }], total: 7, limit: 20, offset: 20 } },
  ]);
  const api = createApi("https://acme.test", fetch);
  const page = await api.list({ ...entry, path: "/api/v1/n/ns" }, 2, "-title");
  assert.equal(page.total, 7);
  assert.equal(page.items.length, 1);
  assert.equal(calls[0]!.url, "https://acme.test/api/v1/n/ns?limit=20&offset=20&sort=-title");
});

test("logout forgets the cookie even when the server refuses", async () => {
  const { fetch } = fakeFetch([{ status: 401, body: { status: 401, detail: "no session" } }]);
  const api = createApi("https://acme.test", fetch, "platformkit_session=old");
  await assert.rejects(api.logout(), ApiError);
  assert.equal(api.cookie(), undefined);
});
