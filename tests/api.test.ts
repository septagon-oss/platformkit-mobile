import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createApi } from "../src/effects/api";

type Call = { url: string; init: RequestInit };
function fakeFetch(
  answers: { status: number; body?: unknown; headers?: Record<string, string> }[],
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
  commands: [],
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
  const page = await api.list({ ...entry, path: "/api/v1/n/ns" }, { offset: 20, sort: "-title" });
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

test("logout clears immediately and late responses cannot restore its cookie", async () => {
  const catalog = Promise.withResolvers<Response>();
  const logout = Promise.withResolvers<Response>();
  const fetchImpl = ((url: string) =>
    url.endsWith("/logout") ? logout.promise : catalog.promise) as typeof fetch;
  const api = createApi("https://acme.test", fetchImpl, "platformkit_session=old");
  const loading = api.catalog();
  const leaving = api.logout();
  assert.equal(api.cookie(), undefined, "local sign-out does not wait for the server");
  catalog.resolve(
    new Response(JSON.stringify({ resources: [] }), {
      headers: { "Set-Cookie": "platformkit_session=late; HttpOnly" },
    }),
  );
  await loading;
  assert.equal(api.cookie(), undefined);
  logout.resolve(
    new Response(null, {
      status: 204,
      headers: { "Set-Cookie": "platformkit_session=logout; HttpOnly" },
    }),
  );
  await leaving;
  assert.equal(api.cookie(), undefined);
});

test("a list is a page in an order through the filters the API takes", async () => {
  const { fetch, calls } = fakeFetch([{ status: 200, body: { items: [], total: 0 } }]);
  const api = createApi("https://acme.test", fetch);
  await api.list(entry, {
    offset: 20,
    sort: "-title",
    filters: ["status:open", "pinned:true"],
  });
  assert.equal(
    calls[0]!.url,
    "https://acme.test/api/v1/note/notes?limit=20&offset=20&sort=-title&filter=status%3Aopen&filter=pinned%3Atrue",
  );
});

test("a server that never answers gives up and says which server it was", async () => {
  // A phone keeps a saved server it may no longer reach; fetch waits forever
  // for one that accepts the connection and then says nothing, so the deadline
  // is what turns an endless spinner into a sentence.
  const hang = ((_url: string, init: RequestInit = {}) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    })) as unknown as typeof fetch;
  const api = createApi("https://gone.test", hang, undefined, 20);
  await assert.rejects(api.catalog(), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.status, 0);
    assert.match(e.message, /https:\/\/gone\.test did not answer within/);
    return true;
  });
});

test("a command posts to the row's own verb, and one that takes nothing sends no body", async () => {
  const { fetch, calls } = fakeFetch([
    { status: 200, body: { id: "1", status: "done" } },
    { status: 200, body: { id: "1" } },
  ]);
  const api = createApi("https://acme.test", fetch);
  await api.command(entry, "1", "resolve", { resolution: "fixed" });
  assert.equal(calls[0]!.url, "https://acme.test/api/v1/note/notes/1/resolve");
  assert.equal(calls[0]!.init.method, "POST");
  assert.equal(calls[0]!.init.body, `{"resolution":"fixed"}`);
  // A command about the collection has no row in its path, and one with no
  // argument has no body at all: "{}" is not something a caller should have to
  // send to say nothing.
  await api.command(entry, undefined, "archive");
  assert.equal(calls[1]!.url, "https://acme.test/api/v1/note/notes/archive");
  assert.equal(calls[1]!.init.body, undefined);
});

test("the trail is asked for one record, a page at a time, and a caller who may not read it has none", async () => {
  const { fetch, calls } = fakeFetch([
    { status: 200, body: { items: [{ id: "e1", name: "n", occurredAt: "now" }], total: 42 } },
    { status: 403, body: { status: 403, detail: "AUTH_DENIED" } },
  ]);
  const api = createApi("https://acme.test", fetch);
  const page = await api.events({ record: "r1", offset: 20, limit: 20 });
  assert.equal(page.total, 42);
  assert.equal(page.items.length, 1);
  const asked = new URL(calls[0]!.url);
  assert.equal(asked.pathname, "/api/v1/audit/events");
  assert.equal(asked.searchParams.get("record"), "r1");
  assert.equal(asked.searchParams.get("offset"), "20");
  assert.deepEqual(await api.events(), { items: [], total: 0 });
});
