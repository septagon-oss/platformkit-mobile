// The shell as a screen sees it, with an Api that answers from memory and
// records every call. A test installs it with
// jest.mock("../src/shell", () => ({ useShell: () => require("./fakes/shell").shell.value }))
// and sets shell.value before rendering; nothing here touches a network.
import { jest } from "@jest/globals";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import { createApi, type Api } from "../../src/effects/api";
import type { Operations } from "../../src/generated/operations.gen";
import type { ShellValue } from "../../src/shell";

export const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
export const note = catalog.resources.find((r) => r.entity === "note")!;
export const setting = catalog.resources.find((r) => r.entity === "setting")!;

export type FakeApi = {
  readonly [K in keyof Api]: Api[K] extends (...args: never[]) => unknown
    ? jest.MockedFunction<Api[K]>
    : Api[K];
};

/**
 * fakeApi answers every request with nothing much and records the call; a test
 * overrides what it needs. `operations` overrides single generated operations on
 * the bound object — the ones a renderer pack reads — and leaves the rest
 * answering the refusal below, so a read no test supplied is a loud failure
 * rather than an empty row.
 */
export function fakeApi(operations: Partial<Operations> = {}): FakeApi {
  const bound = createApi("https://fake.test", (async () => {
    throw new Error("Supply the generated operation fake explicitly.");
  }) as typeof fetch).operations;
  const get = jest.fn<Api["get"]>(async (_e, id) => ({ id }));
  return {
    operations: { ...bound, ...operations },
    // Jest erases the generic return parameter; this implementation obtains T
    // only from the caller's validator, just like the real request boundary.
    request: jest.fn<Api["request"]>(async (_method, _path, validate) =>
      validate(undefined),
    ) as jest.MockedFunction<Api["request"]>,
    composedPicture: jest.fn<Api["composedPicture"]>(async () => {
      throw new Error("Supply SVG explicitly.");
    }),
    me: jest.fn<Api["me"]>(async () => undefined),
    events: jest.fn<Api["events"]>(async () => ({ items: [], total: 0 })),
    signIn: jest.fn<Api["signIn"]>(async () => ({ kind: "signed-in", bearer })),
    answerFactor: jest.fn<Api["answerFactor"]>(async () => bearer),
    logout: jest.fn<Api["logout"]>(async () => ({ revoked: true, live: false })),
    catalog: jest.fn<Api["catalog"]>(async () => catalog),
    list: jest.fn<Api["list"]>(async () => ({ items: [], total: 0 })),
    get,
    // A row this fake remembers was never answered by anyone, so it arrived in no language: a
    // screen reading through `served` sees the row its `get` override answers with and the empty
    // tag. Which language a read really arrived in is a fact about a response, so a test that
    // reads it goes through the transport that prints it.
    served: jest.fn<Api["served"]>(async (e, id) => ({ row: await get(e, id), language: "" })),
    one: jest.fn<Api["one"]>(async () => ({ id: "one" })),
    replace: jest.fn<Api["replace"]>(async (_e, v) => ({ id: "one", ...v })),
    create: jest.fn<Api["create"]>(async (_e, v) => ({ id: "new", ...v })),
    update: jest.fn<Api["update"]>(async (_e, id, v) => ({ id, ...v })),
    remove: jest.fn<Api["remove"]>(async () => undefined),
    upload: jest.fn<Api["upload"]>(async () => ({ id: "file-new" })),
    command: jest.fn<Api["command"]>(async (_e, id) => ({ id: id ?? "" })),
    bearer: jest.fn<Api["bearer"]>(() => bearer),
  };
}

/** bearer is the key a fake shell or Api holds; a test that cares about its text overrides the member. */
export const bearer = { token: "pk_live_1", id: "00000000-0000-4000-8000-000000000001" };

/** json is one wire answer, with the content type the SDK asks the transport for. */
const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * answering is the bound operations over a transport that answers every request
 * with one body. It is the same `createApi(url, fetchLike)` the contract tests
 * use, so the generated validator, the route table and ApiError all stay in the
 * path a screen is tested against — including the refusal a body outside its
 * operation's schema earns, which is the half a stub of `operations` would skip.
 */
export function operationsFrom(fetchImpl: typeof fetch): Operations {
  return createApi("https://fake.test", fetchImpl).operations;
}

export function answering(body: unknown, status = 200): Operations {
  return operationsFrom(async () => json(body, status));
}

/**
 * recorded is a transport that answers with one body and says how many times it
 * was asked — which is how a test proves a screen with nothing to ask about
 * asked for nothing, rather than proving it drew nothing.
 */
export function recorded(
  body: unknown,
  status = 200,
): { readonly calls: string[]; readonly operations: Operations } {
  const calls: string[] = [];
  const operations = operationsFrom(async (input) => {
    calls.push(String(input instanceof Request ? input.url : input));
    return json(body, status);
  });
  return { calls, operations };
}

/** shellValue is a signed-in shell over the catalog fixture; a test overrides the phase, the pack or the writes. */
export function shellValue(api: Api, over: Partial<ShellValue> = {}): ShellValue {
  return {
    api,
    baseURL: "https://acme.test",
    state: { phase: "ready", generation: 1, catalog },
    renderers: {},
    identity: undefined,
    writes: {},
    wrote: jest.fn<ShellValue["wrote"]>(),
    saw: jest.fn<ShellValue["saw"]>(),
    typed: jest.fn<ShellValue["typed"]>(),
    keep: jest.fn<ShellValue["keep"]>(),
    say: jest.fn<ShellValue["say"]>(),
    heard: jest.fn<ShellValue["heard"]>(() => ""),
    report: jest.fn<ShellValue["report"]>(),
    reporting: jest.fn<ShellValue["reporting"]>(() => undefined),
    spent: jest.fn<ShellValue["spent"]>(),
    celebrate: jest.fn<ShellValue["celebrate"]>(),
    celebrating: jest.fn<ShellValue["celebrating"]>(() => false),
    celebrated: jest.fn<ShellValue["celebrated"]>(),
    surprised: jest.fn<ShellValue["surprised"]>(),
    travelTo: jest.fn<ShellValue["travelTo"]>(),
    travelled: jest.fn<ShellValue["travelled"]>(() => undefined),
    returning: undefined,
    // No device store: a screen under test writes live, as it did before the kit could hold a write.
    outbox: undefined,
    reads: undefined,
    // No store, so no remembered opens either: a screen that shows them draws no section,
    // which is what a device without a database is.
    recents: undefined,
    // No store, so no remembered workspaces either: the connect step draws the field alone,
    // which is what a device without a database is.
    workspaces: undefined,
    // Nothing answered this address, so the phone knows its host and nothing else.
    workspace: { server: "https://acme.test", host: "acme.test", name: "" },
    lookUp: jest.fn<ShellValue["lookUp"]>(async () => undefined),
    entry: (module, entity) =>
      catalog.resources.find((r) => r.module === module && r.entity === entity),
    // No push bridge: this phone has no notification address, draws no invite and asks for
    // nothing at the door. A test that speaks push overrides the whole member.
    push: {
      status: "off" as const,
      offer: false,
      decline: jest.fn<ShellValue["push"]["decline"]>(),
      turnOn: jest.fn<ShellValue["push"]["turnOn"]>(async () => undefined),
    },
    signIn: jest.fn<ShellValue["signIn"]>(async () => ({ kind: "signed-in" })),
    answerFactor: jest.fn<ShellValue["answerFactor"]>(async () => undefined),
    signOut: jest.fn<ShellValue["signOut"]>(async () => undefined),
    refresh: jest.fn<ShellValue["refresh"]>(async () => undefined),
    ...over,
  };
}

/** shell is what the mocked useShell answers; set value before rendering. */
export const shell: { value: ShellValue | undefined } = { value: undefined };
