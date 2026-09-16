import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Text } from "react-native";
import { Shell, useShell, type ShellValue } from "../src/shell";

// The secure store, in memory: what a saved sign-in is restored from and
// written to. The factory only closes over it; nothing reads it until a test
// does.
const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
}));

const KEY = "platformkit.session";
const catalogDoc: unknown = JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
const saved = { version: 1, baseURL: "https://saved.test", cookie: "pk=saved" };
const identity = { userId: "u1", email: "a@saved.test" };
const routes = {
  me: "GET /api/v1/auth/me",
  resources: "GET /api/v1/admin/resources",
  login: "POST /api/v1/auth/login",
  logout: "POST /api/v1/auth/logout",
};

type Route = () => Response | Promise<Response>;
interface Call {
  readonly key: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
const empty = (init: ResponseInit = {}) => new Response(null, { status: 204, ...init });

/** server is the network as one test allows it: named routes, every call recorded, anything else 404. */
function server(answers: Record<string, Route>): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const key = `${init.method ?? "GET"} ${new URL(String(input)).pathname}`;
    calls.push({
      key,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    });
    const answer = answers[key];
    return answer ? answer() : json({ detail: `no route for ${key}` }, { status: 404 });
  }) as typeof fetch;
  return calls;
}

// Probe shows the phase and, once rendered, hands the test the whole value.
let latest: ShellValue | undefined;
function Probe() {
  const value = useShell();
  React.useEffect(() => {
    latest = value;
  });
  return <Text testID="phase">{value.state.phase}</Text>;
}
const mount = (baseURL = "https://configured.test") =>
  render(
    <Shell baseURL={baseURL} renderers={{}}>
      <Probe />
    </Shell>,
  );
const phase = (expected: string) =>
  waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent(new RegExp(`^${expected}$`)));

const realFetch = globalThis.fetch;
beforeEach(() => {
  mockStore.clear();
  latest = undefined;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("Shell", () => {
  test("a saved sign-in is restored: its server, its cookie, then the catalog and who it belongs to", async () => {
    mockStore.set(KEY, JSON.stringify(saved));
    const calls = server({
      [routes.me]: () => json(identity),
      [routes.resources]: () => json(catalogDoc),
    });
    await mount();
    await phase("ready");
    expect(latest?.baseURL).toBe("https://saved.test");
    await waitFor(() => expect(latest?.identity).toEqual(identity));
    expect(latest?.state.catalog?.resources.map((r) => r.entity)).toEqual([
      "note",
      "tag",
      "setting",
    ]);
    expect(latest?.entry("note", "note")?.path).toBe("/api/v1/note/notes");
    expect(latest?.entry("note", "invoice")).toBeUndefined();
    expect(calls.map((c) => c.key).sort()).toEqual([routes.resources, routes.me]);
    for (const call of calls) expect(call.headers.Cookie).toBe("pk=saved");
  });

  test("no saved sign-in is anonymous at the configured server; an unreadable one says so and asks nothing of the network", async () => {
    const calls = server({});
    await mount();
    await phase("anonymous");
    expect(latest?.baseURL).toBe("https://configured.test");
    expect(latest?.state.error).toBeUndefined();
    await screen.unmount();
    mockStore.set(KEY, "not a record");
    await mount();
    await phase("anonymous");
    expect(latest?.state.error).toMatch(/saved sign-in could not be read/);
    expect(calls).toEqual([]);
  });

  test("a catalog that answers after sign-out cannot revive the session", async () => {
    mockStore.set(KEY, JSON.stringify(saved));
    const gate = Promise.withResolvers<Response>();
    const calls = server({
      [routes.me]: () => json(identity),
      [routes.resources]: () => gate.promise,
      [routes.logout]: () => empty(),
    });
    await mount();
    await phase("loading");
    await waitFor(() => expect(latest?.identity).toEqual(identity));
    await act(async () => {
      await latest!.signOut();
    });
    await phase("anonymous");
    gate.resolve(json(catalogDoc));
    await act(async () => {
      await gate.promise;
    });
    expect(screen.getByTestId("phase")).toHaveTextContent(/^anonymous$/);
    expect(latest?.state.catalog).toBeUndefined();
    expect(latest?.identity).toBeUndefined();
    expect(latest?.api.cookie()).toBeUndefined();
    // The revocation went out with the old cookie; the store keeps the server and nothing else.
    expect(calls.find((c) => c.key === routes.logout)?.headers.Cookie).toBe("pk=saved");
    expect(JSON.parse(mockStore.get(KEY)!)).toEqual({ version: 1, baseURL: "https://saved.test" });
  });

  test("signing in keeps the cookie the server set, saves it with its server and loads the catalog", async () => {
    const calls = server({
      [routes.login]: () => empty({ headers: { "Set-Cookie": "pk=fresh; Path=/; HttpOnly" } }),
      [routes.me]: () => json(identity),
      [routes.resources]: () => json(catalogDoc),
    });
    await mount();
    await phase("anonymous");
    await act(async () => {
      await latest!.signIn("https://acme.test", "a@acme.test", "pw");
    });
    await phase("ready");
    expect(latest?.baseURL).toBe("https://acme.test");
    expect(calls.find((c) => c.key === routes.login)?.body).toEqual({
      email: "a@acme.test",
      password: "pw",
    });
    expect(calls.find((c) => c.key === routes.resources)?.headers.Cookie).toBe("pk=fresh");
    expect(JSON.parse(mockStore.get(KEY)!)).toEqual({
      version: 1,
      baseURL: "https://acme.test",
      cookie: "pk=fresh",
    });
  });

  test("a server that sets no session is refused, and nothing is saved or loaded", async () => {
    const calls = server({ [routes.login]: () => empty(), [routes.logout]: () => empty() });
    await mount();
    await phase("anonymous");
    let refused: unknown;
    await act(async () => {
      try {
        await latest!.signIn("https://acme.test", "a@acme.test", "pw");
      } catch (e) {
        refused = e;
      }
    });
    expect(String(refused)).toMatch(/did not return a session/);
    await phase("anonymous");
    expect(mockStore.size).toBe(0);
    expect(calls.map((c) => c.key)).not.toContain(routes.resources);
  });

  test("refresh asks nothing for nobody, and writes are counted per resource", async () => {
    const calls = server({});
    await mount();
    await phase("anonymous");
    await act(async () => {
      await latest!.refresh();
    });
    expect(calls).toEqual([]);
    await act(async () => {
      latest!.wrote("note/note");
      latest!.wrote("note/note");
      latest!.wrote("note/tag");
    });
    expect(latest?.writes).toEqual({ "note/note": 2, "note/tag": 1 });
  });
});
