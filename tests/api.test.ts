import { issuedTokenResponse, loginResponse, issuedToken, loginIdentity } from "./fakes/wire";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { acceptLanguage, ApiError, createApi } from "../src/effects/api";
import { parseCatalog } from "../src/core/catalog";
import { deriveCopy, failureSubject, formControls, values } from "../src/core/derive";
import { refusalOf } from "../src/screens/failure";

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
  singleton: false,
};

test("sign-in mints a key with the session and sends only the key after it", async () => {
  const { fetch, calls } = fakeFetch([
    {
      status: 200,
      body: loginIdentity,
      headers: { "Set-Cookie": "platformkit_session=abc; Path=/; HttpOnly" },
    },
    { status: 201, body: issuedToken },
    {
      status: 200,
      body: { resources: [] },
      headers: { "Set-Cookie": "platformkit_session=later; Path=/" },
    },
  ]);
  const api = createApi("https://acme.test", fetch);
  await api.signIn("a@acme.test", "pw");
  const c = await api.catalog();
  assert.equal(c.resources.length, 0);
  assert.equal(calls[0]!.url, "https://acme.test/api/v1/auth/login");
  // The mint is the one request that carries the session the login set.
  assert.equal(
    (calls[1]!.init.headers as Record<string, string>).Cookie,
    "platformkit_session=abc",
  );
  // Every request after it carries the key alone, and a Set-Cookie that arrives
  // later changes nothing observable: no response sets a credential here.
  const after = calls[2]!.init.headers as Record<string, string>;
  assert.equal(after.Authorization, `Bearer ${issuedToken.token}`);
  assert.equal(after.Cookie, undefined);
  assert.equal((api.catalog, api.bearer())!.token, issuedToken.token);
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

test("the captured PlatformKit validation response identifies body fields", async () => {
  // Captured through Huma with PlatformKit's installed problem.HumaError hook.
  const body = JSON.parse(
    readFileSync(new URL("../testdata/platformkit-validation.json", import.meta.url), "utf8"),
  );
  const { fetch } = fakeFetch([{ status: 422, body }]);
  await assert.rejects(createApi("https://acme.test", fetch).create(entry, {}), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.detail, "validation failed");
    assert.deepEqual(e.fields, {
      "details.code": "expected length >= 2",
      title: "expected length >= 3",
    });
    return true;
  });
});

test("structured Huma errors preserve nested paths and do not relabel query errors", async () => {
  const { fetch } = fakeFetch([
    {
      status: 422,
      body: {
        detail: "Review the invalid fields",
        errors: [
          { location: "body.title", message: "is already in use", value: "Private input" },
          { location: "body.items[2].code", message: "is required" },
          { location: "query.title", message: "is not a supported filter" },
        ],
      },
    },
  ]);
  await assert.rejects(createApi("https://acme.test", fetch).create(entry, {}), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.detail, "Review the invalid fields");
    assert.deepEqual(e.fields, {
      title: "is already in use",
      "items[2].code": "is required",
      "query.title": "is not a supported filter",
    });
    assert.ok(!JSON.stringify(e).includes("Private input"));
    return true;
  });
});

test("malformed error entries do not hide later valid errors", async () => {
  const { fetch } = fakeFetch([
    {
      status: 422,
      body: {
        detail: 17,
        errors: [
          null,
          7,
          false,
          [],
          {},
          { location: "body.title", message: 42 },
          { location: 4, message: "not a location" },
          "unlocated failure",
          ": no field",
          "body.: no field",
          "body.title: ",
          "body.details.code: preserve the rest: of this message",
          { location: "body.title", message: "is required" },
          "summary: legacy field message",
        ],
      },
    },
  ]);
  await assert.rejects(createApi("https://acme.test", fetch).create(entry, {}), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.status, 422);
    assert.equal(e.detail, "");
    assert.deepEqual(e.fields, {
      "details.code": "preserve the rest: of this message",
      title: "is required",
      summary: "legacy field message",
    });
    return true;
  });
});

for (const errors of [null, 7, "title: wrong container", { title: "wrong container" }]) {
  test(`a non-array errors member preserves the problem detail: ${JSON.stringify(errors)}`, async () => {
    const { fetch } = fakeFetch([{ status: 422, body: { detail: "Review this request", errors } }]);
    await assert.rejects(createApi("https://acme.test", fetch).create(entry, {}), (e: unknown) => {
      assert.ok(e instanceof ApiError);
      assert.equal(e.detail, "Review this request");
      assert.deepEqual(e.fields, {});
      return true;
    });
  });
}

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

test("logout revokes the key and forgets it even when the server refuses", async () => {
  const { fetch, calls } = fakeFetch([{ status: 503, body: { status: 503, detail: "no tokens" } }]);
  const api = createApi("https://acme.test", fetch, {
    token: "pk_live_old",
    id: "00000000-0000-4000-8000-000000000009",
  });
  await assert.rejects(api.logout(), ApiError);
  assert.equal(api.bearer(), undefined);
  assert.ok(
    calls[0]!.url.endsWith("/api/v1/auth/tokens/00000000-0000-4000-8000-000000000009/revoke"),
  );
  assert.equal(
    (calls[0]!.init.headers as Record<string, string>).Authorization,
    "Bearer pk_live_old",
  );
});

test("logout clears immediately and late responses cannot restore a credential", async () => {
  const catalog = Promise.withResolvers<Response>();
  const revoke = Promise.withResolvers<Response>();
  const fetchImpl = ((url: string) =>
    url.endsWith("/revoke") ? revoke.promise : catalog.promise) as typeof fetch;
  const api = createApi("https://acme.test", fetchImpl, {
    token: "pk_live_old",
    id: "00000000-0000-4000-8000-000000000009",
  });
  const loading = api.catalog();
  const leaving = api.logout();
  assert.equal(api.bearer(), undefined, "local sign-out does not wait for the server");
  catalog.resolve(
    new Response(JSON.stringify({ resources: [] }), {
      headers: { "Set-Cookie": "platformkit_session=late; HttpOnly" },
    }),
  );
  await loading;
  assert.equal(api.bearer(), undefined);
  revoke.resolve(
    new Response(JSON.stringify({ done: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "platformkit_session=revoke; HttpOnly",
      },
    }),
  );
  await leaving;
  assert.equal(api.bearer(), undefined);
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
    {
      status: 200,
      body: {
        items: [
          {
            id: "55555555-1111-4111-8111-111111111111",
            eventId: "66666666-1111-4111-8111-111111111111",
            name: "n",
            occurredAt: "2026-10-01T12:00:00Z",
            payload: {},
          },
        ],
        total: 42,
        limit: 20,
        offset: 20,
      },
    },
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

test("a refusal about the plan is told apart from a refusal about the caller", async () => {
  // 402 is what the kernel answers when a tenant's plan excludes an
  // operation. It is a different sentence on screen and a different way out,
  // so a screen asks the error rather than comparing a number.
  const { fetch } = fakeFetch([
    {
      status: 402,
      body: {
        status: 402,
        detail: "PLAN_EXCLUDES: this tenant's plan does not include audit-trail",
      },
    },
    {
      status: 403,
      body: { status: 403, detail: "AUTH_DENIED: this operation requires audit:read" },
    },
  ]);
  const api = createApi("https://acme.test", fetch);
  await assert.rejects(api.get(entry, "1"), (e: unknown) => {
    assert.ok(e instanceof ApiError && e.excluded);
    return true;
  });
  await assert.rejects(api.get(entry, "1"), (e: unknown) => {
    assert.ok(e instanceof ApiError && !e.excluded);
    return true;
  });
});

test("the deadline covers reading the body, not only getting the headers", async () => {
  // fetch resolves on the headers. A server that answers 200 and then stalls
  // the body is the same endless spinner as one that never answers, and
  // clearing the timer when fetch resolved left exactly that hole open.
  const stalls = ((_url: string, init: RequestInit = {}) =>
    Promise.resolve({
      status: 200,
      headers: new Headers(),
      text: () =>
        new Promise<string>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    })) as unknown as typeof fetch;
  const api = createApi("https://slow.test", stalls, undefined, 20);
  await assert.rejects(api.catalog(), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.match(e.message, /did not answer within/);
    return true;
  });
});

test("a write the deadline took is one nobody answered, and is never offered again", async () => {
  // Whether the same write may go out a second time turns on one fact: did anybody
  // answer? The deadline's own error has to carry that fact to the classifier, or a
  // save that timed out reads "we couldn't save your changes" and invites the send
  // that may already have landed.
  const hang = ((_url: string, init: RequestInit = {}) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    })) as unknown as typeof fetch;
  const api = createApi("https://gone.test", hang, undefined, 20);
  const thrown = await api.update(entry, "1", { title: "later" }).then(
    () => undefined,
    (e: unknown) => e,
  );
  assert.ok(thrown instanceof ApiError && thrown.status === 0, "nothing answered the write");
  const refusal = refusalOf(thrown, "update", failureSubject(entry), deriveCopy("en"));
  assert.equal(refusal.text, deriveCopy("en").failure.uncertain);
  const verdict = refusal.verdict;
  if (verdict.outcome !== "notice") throw new Error(`expected a notice, got ${verdict.outcome}`);
  assert.equal(verdict.code, "write-unknown");
  assert.equal(verdict.action, "reconcile", "an unanswered write is never retried");
});

test("a singleton is read and written at the path itself", async () => {
  const { fetch, calls } = fakeFetch([
    { status: 200, body: { id: "1", title: "Acme" } },
    { status: 200, body: { id: "1", title: "Acme Inc" } },
  ]);
  const api = createApi("https://acme.test", fetch);
  const single = { ...entry, path: "/api/v1/site/settings", singleton: true };
  await api.one(single);
  assert.equal(calls[0]!.url, "https://acme.test/api/v1/site/settings");
  assert.equal(calls[0]!.init.method, "GET");
  // A singleton's write is a PUT of the whole of it: there is no id in the
  // path and no PATCH route behind it.
  await api.replace(single, { title: "Acme Inc" });
  assert.equal(calls[1]!.url, "https://acme.test/api/v1/site/settings");
  assert.equal(calls[1]!.init.method, "PUT");
  assert.equal(calls[1]!.init.body, `{"title":"Acme Inc"}`);
});

test("a generated edit sends cleared text and typed list items in its PATCH body", async () => {
  const resource = {
    ...entry,
    fields: [
      { name: "summary", type: "text" as const },
      { name: "counts", type: "list" as const, elem: "int" as const },
      { name: "absent", type: "string" as const },
    ],
  };
  const { fetch, calls } = fakeFetch([
    { status: 200, body: { id: "7", summary: "", counts: [-4, 2] } },
  ]);
  const api = createApi("https://acme.test", fetch);
  const controls = formControls(resource, { id: "7", summary: "Saved", counts: [1] }, false);
  await api.update(resource, "7", values(controls, { summary: "", counts: "-4, 2" }));
  assert.equal(calls[0]!.url, "https://acme.test/api/v1/note/notes/7");
  assert.equal(calls[0]!.init.method, "PATCH");
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { summary: "", counts: [-4, 2] });
});

// The acceptance case for a version-2 document: the reads stay where they
// always were and the writes go to the address the catalogue named, which for
// these two resources is a different surface. Every assertion below is the
// address, not the shape of a request — the shapes are pinned above.

const controlPlane = parseCatalog(
  JSON.parse(
    readFileSync(
      new URL("../testdata/catalog.control-plane.json", import.meta.url).pathname,
      "utf8",
    ),
  ),
);
const priceLists = controlPlane.resources[3]!;
const currency = controlPlane.resources[4]!;

test("a write goes where the catalogue says and a read stays where it was", async () => {
  const { fetch, calls } = fakeFetch([
    { status: 201, body: { id: "1" } },
    { status: 200, body: { id: "1" } },
    { status: 204 },
    { status: 200, body: { id: "1" } },
    { status: 200, body: { items: [], total: 0 } },
    { status: 200, body: { id: "1" } },
  ]);
  const api = createApi("https://acme.test", fetch);
  await api.create(priceLists, { title: "Autumn" });
  await api.update(priceLists, "1", { title: "Autumn" });
  await api.remove(priceLists, "1");
  await api.command(priceLists, "1", "retire", { reason: "superseded" });
  await api.list(priceLists);
  await api.get(priceLists, "1");
  const sent = calls.map((c) => [c.init.method, new URL(c.url).pathname]) as [
    string | undefined,
    string,
  ][];
  assert.deepEqual(sent, [
    ["POST", "/api/v1/ops/pricing/price-lists"],
    ["PATCH", "/api/v1/ops/pricing/price-lists/1"],
    ["DELETE", "/api/v1/ops/pricing/price-lists/1"],
    ["POST", "/api/v1/ops/pricing/price-lists/1/retire"],
    ["GET", "/api/v1/pricing/price-lists"],
    ["GET", "/api/v1/pricing/price-lists/1"],
  ]);
  // The list keeps the paging it always sent; only the surface moved.
  assert.match(calls[4]!.url, /\?limit=20&offset=0$/);
});

test("a singleton's PUT follows its write path, and its GET stays on its own", async () => {
  const { fetch, calls } = fakeFetch([
    { status: 200, body: { id: "1", code: "EUR" } },
    { status: 200, body: { id: "1", code: "EUR" } },
  ]);
  const api = createApi("https://acme.test", fetch);
  await api.one(currency);
  await api.replace(currency, { code: "EUR" });
  assert.deepEqual(
    calls.map((c) => [c.init.method, c.url.slice("https://acme.test".length)]),
    [
      ["GET", "/api/v1/pricing/currency"],
      ["PUT", "/api/v1/ops/pricing/currency"],
    ],
  );
});

test("an entry that names no write address is written where it always was", async () => {
  // The regression gate: this change moved the derivation, not the answer, for
  // every resource the pinned document describes — which is the only way a
  // build that reads version 2 can still serve a server on version 1.
  const { fetch, calls } = fakeFetch([
    { status: 201, body: { id: "1" } },
    { status: 200, body: { id: "1" } },
    { status: 204 },
    { status: 200, body: { id: "1" } },
  ]);
  const api = createApi("https://acme.test", fetch);
  const note = parseCatalog(
    JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8")),
  ).resources[0]!;
  await api.create(note, { title: "x" });
  await api.update(note, "1", { title: "x" });
  await api.remove(note, "1");
  await api.command(note, "1", "publish", {});
  assert.deepEqual(
    calls.map((c) => [c.init.method, c.url.slice("https://acme.test".length)]),
    [
      ["POST", "/api/v1/note/notes"],
      ["PATCH", "/api/v1/note/notes/1"],
      ["DELETE", "/api/v1/note/notes/1"],
      ["POST", "/api/v1/note/notes/1/publish"],
    ],
  );
});

test("a command whose printed address needs a row is refused before anything is sent", async () => {
  const { fetch, calls } = fakeFetch([]);
  const api = createApi("https://acme.test", fetch);
  await assert.rejects(
    () => api.command(priceLists, undefined, "retire", { reason: "x" }),
    (e: unknown) => e instanceof TypeError && e.message.includes('command "retire" is answered at'),
  );
  assert.equal(calls.length, 0, "the transport was asked to send an address it never got");
});

const composedDoor = "/api/v1/picture/pictures/{reference}/content";
const oracle = readFileSync("testdata/composed-picture.svg", "utf8");
async function pictureConnection(
  answer: (input: string, init: RequestInit) => Promise<Response>,
  options: { factor?: boolean; timeout?: number; refused?: () => void } = {},
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const api = createApi(
    "https://pictures.example.test/",
    async (input, init = {}) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/auth/login") || url.endsWith("/auth/challenge/verify"))
        return loginResponse({
          headers: { "Set-Cookie": "platformkit_session=synthetic; HttpOnly" },
        });
      if (url.endsWith("/auth/tokens")) return issuedTokenResponse();
      return answer(url, init);
    },
    undefined,
    options.timeout ?? 15000,
    undefined,
    undefined,
    options.refused,
  );
  if (options.factor) await api.answerFactor("member@example.test", "123456");
  else await api.signIn("member@example.test", "synthetic-password");
  return { api, calls };
}
const svgResponse = (body = oracle, init: ResponseInit = {}) =>
  new Response(body, {
    status: 200,
    headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
    ...init,
  });

test("a declared composed GET sends the sign-in cookie alone and JSON still sends bearer alone", async () => {
  const { api, calls } = await pictureConnection(async (url) =>
    url.endsWith("/content")
      ? svgResponse()
      : new Response("{}", { headers: { "Content-Type": "application/json" } }),
  );
  assert.equal(await api.composedPicture(composedDoor, "c1.c2hhcGUvYWxwaGE"), oracle);
  const request = calls[2]!;
  assert.equal(
    request.url,
    "https://pictures.example.test/api/v1/picture/pictures/c1.c2hhcGUvYWxwaGE/content",
  );
  assert.deepEqual(request.init, {
    method: "GET",
    headers: {
      Accept: "image/svg+xml",
      "Accept-Language": acceptLanguage(),
      Cookie: "platformkit_session=synthetic",
    },
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    signal: request.init.signal,
  });
  await api.request("GET", "/api/v1/note/notes", (v) => v);
  const headers = calls[3]!.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${issuedToken.token}`);
  assert.equal(headers.Cookie, undefined);
});

test("factor sign-in owns its image session and image Set-Cookie never replaces it", async () => {
  const { api, calls } = await pictureConnection(
    async () =>
      svgResponse(oracle, {
        headers: {
          "Content-Type": "IMAGE/SVG+XML; charset=UTF-8",
          "Set-Cookie": "platformkit_session=replacement",
        },
      }),
    { factor: true },
  );
  await api.composedPicture(composedDoor, "c1.YQ");
  await api.composedPicture(composedDoor, "c1.w6k");
  assert.equal(calls[0]!.url, "https://pictures.example.test/api/v1/auth/challenge/verify");
  for (const call of calls.slice(2)) {
    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers.Cookie, "platformkit_session=synthetic");
    assert.equal(headers.Authorization, undefined);
  }
});

test("restored keys and invalid composed inputs never send content requests", async () => {
  let sent = 0;
  const restored = createApi(
    "https://pictures.example.test",
    async () => {
      sent++;
      return new Response("{}", { headers: { "Content-Type": "application/json" } });
    },
    { token: "pk_live_restored", id: "restored-key" },
  );
  await assert.rejects(
    restored.composedPicture(composedDoor, "c1.YQ"),
    (e: unknown) => e instanceof ApiError && e.status === 403,
  );
  assert.equal(sent, 0);
  await restored.request("GET", "/api/v1/note/notes", (v) => v);
  assert.equal(sent, 1);
  const { api, calls } = await pictureConnection(async () => svgResponse());
  for (const [door, reference] of [
    ["", "c1.YQ"],
    ["https://remote.test/{reference}", "c1.YQ"],
    [composedDoor, "c1.YR"],
    [composedDoor, "uuid"],
  ])
    await assert.rejects(api.composedPicture(door!, reference!), TypeError);
  assert.equal(calls.length, 2);
});

test("composed HTTP refusals return no XML and only a 401 notifies session expiry", async () => {
  for (const status of [401, 403, 404, 410, 422, 429, 503]) {
    let expired = 0;
    const { api, calls } = await pictureConnection(
      async () => new Response("unavailable", { status }),
      { refused: () => expired++ },
    );
    await assert.rejects(
      api.composedPicture(composedDoor, "c1.YQ"),
      (e: unknown) => e instanceof ApiError && e.status === status,
    );
    assert.equal(expired, status === 401 ? 1 : 0);
    assert.equal(calls.length, 3);
  }
});

test("SVG response shape and received byte limit refuse incomplete or unexpected answers", async () => {
  for (const response of [
    () => new Response(null, { status: 204 }),
    () => new Response(oracle, { status: 206 }),
    () => new Response(null, { status: 304 }),
    () => new Response(oracle, { headers: { "Content-Type": "text/html" } }),
    () => svgResponse(""),
    () => svgResponse(" \n\t"),
    () =>
      svgResponse("é".repeat(524288) + "a", {
        headers: { "Content-Type": "image/svg+xml", "Content-Length": "1" },
      }),
    () => new Response(new Uint8Array([255]), { headers: { "Content-Type": "image/svg+xml" } }),
  ]) {
    const { api } = await pictureConnection(async () => response());
    await assert.rejects(api.composedPicture(composedDoor, "c1.YQ"), /Invalid picture response/);
  }
  const boundary = oracle + " ".repeat(1048576 - Buffer.byteLength(oracle));
  const { api } = await pictureConnection(async () => svgResponse(boundary));
  assert.equal(await api.composedPicture(composedDoor, "c1.YQ"), boundary);
});

test("composed cancellation and deadline include body consumption without retry or partial XML", async () => {
  for (const mode of ["before", "during", "deadline"]) {
    const stop = new AbortController();
    const reading = Promise.withResolvers<void>();
    const { api, calls } = await pictureConnection(
      async (_url, init) => {
        const response = svgResponse();
        response.arrayBuffer = () =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
              once: true,
            });
            reading.resolve();
          });
        return response;
      },
      { timeout: mode === "deadline" ? 20 : 15000 },
    );
    if (mode === "before") stop.abort();
    const result = api.composedPicture(composedDoor, "c1.YQ", { signal: stop.signal });
    if (mode === "during") {
      await reading.promise;
      stop.abort();
    }
    await assert.rejects(
      result,
      mode === "deadline"
        ? /did not answer within/
        : (e: unknown) => e instanceof Error && e.name === "AbortError",
    );
    assert.equal(calls.length, mode === "before" ? 2 : 3);
  }
});
