// Every success crosses its wire contract; errors name fields rather than values.
// Documented calls are validated by their generated operation, while arbitrary
// catalog rows keep the generic record/page contract and custom reads supply one.
import assert from "node:assert/strict";
import test from "node:test";
import { createApi, ApiError } from "../src/effects/api";
import { parseCatalog } from "../src/core/catalog";
import type { Catalog } from "../src/generated/types.gen";
import { loginIdentity } from "./fakes/wire";

// If generated types become any, TypeScript refuses the unused expectation.
// @ts-expect-error The document does not publish this property.
type MissingCatalogMember = Catalog["notInTheDocument"];

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
const validPage = { items: [{ title: "Inspect pump" }], total: 3, limit: 2, offset: 1 };
function responding(body: unknown, status = 200, contentType = "application/json") {
  let calls = 0;
  const api = createApi("https://contract.test", (async () => {
    calls++;
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": contentType },
    });
  }) as typeof fetch);
  return { api, calls: () => calls };
}
const refused = (field: string) => (error: unknown) => {
  assert.ok(error instanceof ApiError);
  assert.ok(error.detail.includes(field), error.detail);
  assert.deepEqual(error.fields, {});
  assert.ok(!error.detail.includes("private-value"));
  return true;
};

test("documented pages validate their own row and all pagination members without coercion", async () => {
  for (const [field, value] of [
    ["items", "private-value"],
    ["total", "3"],
    ["limit", 1.5],
    ["offset", null],
  ] as const)
    await assert.rejects(
      responding({ ...validPage, [field]: value }).api.list(entry),
      refused(field),
    );
  for (const field of ["items", "total", "limit", "offset"] as const) {
    const missing: Record<string, unknown> = { ...validPage };
    delete missing[field];
    await assert.rejects(responding(missing).api.list(entry), refused(field));
  }
  await assert.rejects(
    responding({ ...validPage, items: [null] }).api.list(entry),
    refused("items[0]"),
  );
  await assert.rejects(
    responding({ ...validPage, items: [{ title: 23 }] }).api.list(entry),
    refused("items[0].title"),
  );
  assert.deepEqual(await responding({ ...validPage, items: null, total: -1 }).api.list(entry), {
    items: [],
    total: -1,
  });
});

test("renderers invoke generated operations over the selected connection and the same validators", async () => {
  const { api, calls } = responding(validPage);
  const result = await api.operations.taskTaskList({});
  assert.deepEqual(result.data, validPage);
  assert.equal(calls(), 1);
  await assert.rejects(
    responding({ ...loginIdentity, userId: 5 }).api.operations.authMe({}),
    refused("userId"),
  );
});

test("a server content type cannot disable validation of a documented JSON success", async () => {
  await assert.rejects(
    responding({ ...validPage, items: "private-value" }, 200, "text/plain").api.list(entry),
    refused("items"),
  );
});

test("identity and audit contract failures are never optional-identity or empty-trail fallbacks", async () => {
  for (const field of ["userId", "email", "roles", "permissions"]) {
    const body: Record<string, unknown> = { ...loginIdentity };
    delete body[field];
    await assert.rejects(responding(body).api.me(), refused(field));
  }
  const event = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    eventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "task.task.created",
    occurredAt: "2026-10-07T01:02:03Z",
    payload: {},
  };
  for (const field of ["eventId", "occurredAt", "payload"]) {
    const body: Record<string, unknown> = { ...event };
    delete body[field];
    await assert.rejects(
      responding({ ...validPage, items: [body] }).api.events(),
      refused(`items[0].${field}`),
    );
  }
  await assert.rejects(
    responding({ ...validPage, items: [{ ...event, occurredAt: "yesterday" }] }).api.events(),
    refused("occurredAt"),
  );
  for (const status of [403, 404])
    assert.deepEqual(await responding({}, status).api.events(), { items: [], total: 0 });
  assert.equal(await responding({}, 401).api.me(), undefined);
});

test("login and logout validate even void public results and reject undocumented success statuses", async () => {
  await responding(loginIdentity).api.login("member@example.test", "password");
  await responding({ signedOut: true }).api.logout();
  for (const action of [
    (api: ReturnType<typeof createApi>) => api.login("m@example.test", "p"),
    (api: ReturnType<typeof createApi>) => api.logout(),
  ]) {
    await assert.rejects(action(responding({}, 204).api), refused("unexpected response status"));
    await assert.rejects(action(responding({}).api), refused("Invalid response"));
  }
  await responding(undefined, 204).api.remove(entry, "t1");
});

test("generic rows refuse primitives and a malformed write makes one attempt", async () => {
  const other = { ...entry, path: "/api/v1/other/items" };
  for (const value of [null, [], 9, "private-value"]) {
    const { api, calls } = responding(value);
    await assert.rejects(api.create(other, { title: "sent once" }), refused("$"));
    assert.equal(calls(), 1);
  }
});

test("catalog normalization preserves generated metadata and only defaults declared nullable arrays", () => {
  assert.deepEqual(parseCatalog({ resources: null }), { version: 0, resources: [] });
  const catalog = parseCatalog({
    catalogVersion: 2,
    resources: [
      {
        module: "x",
        entity: "item",
        path: "/api/v1/x/items",
        writable: true,
        screen: "/app/x/items",
        fields: [{ name: "title", type: "string", enum: null, present: "badge" }],
        commands: null,
        immutable: null,
      },
    ],
  });
  assert.equal(catalog.resources[0]?.screen, "/app/x/items");
  assert.equal(catalog.resources[0]?.fields[0]?.present, "badge");
  assert.equal(catalog.resources[0]?.fields[0]?.enum, undefined);
  assert.deepEqual(catalog.resources[0]?.commands, []);
  for (const catalogVersion of [0, "2", 1.5, 3])
    assert.throws(() => parseCatalog({ catalogVersion, resources: [] }), /catalogVersion/);
  assert.throws(() => parseCatalog({ catalogVersion: 2 }), /resources/);
  assert.throws(
    () =>
      parseCatalog({
        resources: [{ module: "x", entity: "item", path: "/api/v1/x/items", writable: true }],
      }),
    /fields/,
  );
});

test("the React Native Request polyfill sends JSON and bodyless reads without a body stream", async () => {
  // React Native's Network/fetch.js loads this same polyfill. This checks the
  // adapter contract in Node, not a native network or a device journey.
  const { createRequire } = await import("node:module");
  const polyfill = createRequire(import.meta.url)("whatwg-fetch") as {
    Request: typeof Request;
    Response: typeof Response;
    Headers: typeof Headers;
  };
  const originals = { Request, Response, Headers };
  const calls: RequestInit[] = [];
  try {
    Object.assign(globalThis, {
      Request: polyfill.Request,
      Response: polyfill.Response,
      Headers: polyfill.Headers,
    });
    const request = new Request("https://contract.test/api/v1/auth/me");
    assert.equal(request.body, undefined);
    const api = createApi("https://contract.test", (async (_url, init) => {
      calls.push(init!);
      return new Response(JSON.stringify(loginIdentity), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch);
    await api.login("member@example.test", "secret");
    assert.equal(
      calls[0]?.body,
      JSON.stringify({ email: "member@example.test", password: "secret" }),
    );
    assert.deepEqual(await api.me(), { userId: loginIdentity.userId, email: loginIdentity.email });
    assert.equal(calls[1]?.body, undefined);
  } finally {
    Object.assign(globalThis, originals);
  }
});

test("an empty-body hint cannot skip a documented operation's validator", async () => {
  for (const body of [null, JSON.stringify({ ...loginIdentity, userId: 7 })]) {
    const api = createApi(
      "https://contract.test",
      (async () =>
        new Response(body, {
          status: 200,
          headers: { "Content-Type": "application/json", "Content-Length": "0" },
        })) as typeof fetch,
    );
    await assert.rejects(api.operations.authMe({}), refused("Invalid response"));
  }
});

test("documented JSON requests refuse unserializable bodies and unsafe paths before fetch", async () => {
  const { api, calls } = responding({ title: "unused" });
  await assert.rejects(
    api.request(
      "POST",
      entry.path,
      (value) => value,
      () => 1,
    ),
    /body is not JSON/,
  );
  await assert.rejects(
    api.request("GET", `${entry.path}/raw space`, (value) => value),
    /encoded API path/,
  );
  await assert.rejects(
    api.request("POST", "/api/v1/file/files", (value) => value, {}),
    /multipart/,
  );
  assert.equal(calls(), 0);
});
