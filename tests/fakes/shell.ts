// The shell as a screen sees it, with an Api that answers from memory and
// records every call. A test installs it with
// jest.mock("../src/shell", () => ({ useShell: () => require("./fakes/shell").shell.value }))
// and sets shell.value before rendering; nothing here touches a network.
import { jest } from "@jest/globals";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import type { Api } from "../../src/effects/api";
import type { ShellValue } from "../../src/shell";

export const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
export const note = catalog.resources.find((r) => r.entity === "note")!;
export const setting = catalog.resources.find((r) => r.entity === "setting")!;

export type FakeApi = { readonly [K in keyof Api]: jest.MockedFunction<Api[K]> };

/** fakeApi answers every request with nothing much and records the call; a test overrides what it needs. */
export function fakeApi(): FakeApi {
  return {
    request: jest.fn<Api["request"]>(async () => undefined),
    me: jest.fn<Api["me"]>(async () => undefined),
    events: jest.fn<Api["events"]>(async () => ({ items: [], total: 0 })),
    login: jest.fn<Api["login"]>(async () => undefined),
    logout: jest.fn<Api["logout"]>(async () => undefined),
    catalog: jest.fn<Api["catalog"]>(async () => catalog),
    list: jest.fn<Api["list"]>(async () => ({ items: [], total: 0 })),
    get: jest.fn<Api["get"]>(async (_e, id) => ({ id })),
    one: jest.fn<Api["one"]>(async () => ({ id: "one" })),
    replace: jest.fn<Api["replace"]>(async (_e, v) => ({ id: "one", ...v })),
    create: jest.fn<Api["create"]>(async (_e, v) => ({ id: "new", ...v })),
    update: jest.fn<Api["update"]>(async (_e, id, v) => ({ id, ...v })),
    remove: jest.fn<Api["remove"]>(async () => undefined),
    command: jest.fn<Api["command"]>(async (_e, id) => ({ id: id ?? "" })),
    cookie: jest.fn<Api["cookie"]>(() => "pk=1"),
  };
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
    entry: (module, entity) =>
      catalog.resources.find((r) => r.module === module && r.entity === entity),
    signIn: jest.fn<ShellValue["signIn"]>(async () => undefined),
    signOut: jest.fn<ShellValue["signOut"]>(async () => undefined),
    refresh: jest.fn<ShellValue["refresh"]>(async () => undefined),
    ...over,
  };
}

/** shell is what the mocked useShell answers; set value before rendering. */
export const shell: { value: ShellValue | undefined } = { value: undefined };
