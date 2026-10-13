import { issuedTokenResponse, loginResponse, revokeResponse } from "./fakes/wire";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Text } from "react-native";
import { Shell, useShell, type ShellValue } from "../src/shell";
import type { SignInStep } from "../src/effects/api";

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
const saved = {
  version: 2,
  baseURL: "https://saved.test",
  token: "pk_live_saved",
  tokenId: "00000000-0000-4000-8000-000000000009",
};
const identity = {
  userId: "00000001-1111-4111-8111-111111111111",
  email: "a@saved.test",
  permissions: [] as string[],
};
const routes = {
  me: "GET /api/v1/auth/me",
  resources: "GET /api/v1/app/resources",
  login: "POST /api/v1/auth/login",
  tokens: "POST /api/v1/auth/tokens",
  // The revoke addresses the id the saved record names, which is not the id a
  // mint in this file answers with.
  logout: `POST /api/v1/auth/tokens/${saved.tokenId}/revoke`,
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
  test("a saved sign-in is restored: its server, its key, then the catalog and who it belongs to", async () => {
    mockStore.set(KEY, JSON.stringify(saved));
    const calls = server({
      [routes.me]: () => json({ ...identity, roles: [], permissions: [] }),
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
    // Every request after the restore presents the saved key and no cookie: the
    // record holds no cookie to present, and nothing read it if it did.
    for (const call of calls) {
      expect(call.headers.Authorization).toBe("Bearer pk_live_saved");
      expect(call.headers.Cookie).toBeUndefined();
    }
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
      [routes.me]: () => json({ ...identity, roles: [], permissions: [] }),
      [routes.resources]: () => gate.promise,
      [routes.logout]: () => revokeResponse(),
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
    expect(latest?.api.bearer()?.token).toBeUndefined();
    // The revocation went out with the key it spends; the store keeps the server
    // and nothing else.
    expect(calls.find((c) => c.key === routes.logout)?.headers.Authorization).toBe(
      "Bearer pk_live_saved",
    );
    expect(JSON.parse(mockStore.get(KEY)!)).toEqual({ version: 2, baseURL: "https://saved.test" });
  });

  test("signing in mints a key, saves it with its server and loads the catalog", async () => {
    const calls = server({
      [routes.login]: () =>
        loginResponse({ headers: { "Set-Cookie": "pk=fresh; Path=/; HttpOnly" } }),
      [routes.tokens]: () => issuedTokenResponse(),
      [routes.me]: () => json({ ...identity, roles: [] }),
      [routes.resources]: () => json(catalogDoc),
    });
    await mount();
    await phase("anonymous");
    let step: SignInStep | undefined;
    await act(async () => {
      step = await latest!.signIn("https://acme.test", "a@acme.test", "pw");
    });
    expect(step).toEqual({ kind: "signed-in" });
    await phase("ready");
    expect(latest?.baseURL).toBe("https://acme.test");
    expect(calls.find((c) => c.key === routes.login)?.body).toEqual({
      email: "a@acme.test",
      password: "pw",
    });
    // The mint is the one request that presents the session the login set; the
    // catalog read after it presents the key alone.
    expect(calls.find((c) => c.key === routes.tokens)?.headers.Cookie).toBe("pk=fresh");
    expect(calls.find((c) => c.key === routes.resources)?.headers.Authorization).toBe(
      "Bearer pk_live_this_phone",
    );
    expect(calls.find((c) => c.key === routes.resources)?.headers.Cookie).toBeUndefined();
    expect(JSON.parse(mockStore.get(KEY)!)).toEqual({
      version: 2,
      baseURL: "https://acme.test",
      token: "pk_live_this_phone",
      tokenId: "22222222-2222-4222-8222-222222222222",
    });
  });

  test("a server that mints no key is refused, and nothing is saved or loaded", async () => {
    const calls = server({
      [routes.login]: () =>
        loginResponse({ headers: { "Set-Cookie": "pk=fresh; Path=/; HttpOnly" } }),
      [routes.tokens]: () =>
        json(
          { type: "about:blank", status: 503, detail: "the token door is shut" },
          { status: 503, headers: { "Content-Type": "application/problem+json" } },
        ),
      [routes.logout]: () => revokeResponse(),
    });
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
    expect(String(refused)).toMatch(/the token door is shut/);
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
