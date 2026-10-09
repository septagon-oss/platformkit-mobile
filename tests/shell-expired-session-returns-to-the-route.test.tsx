// A session the server refuses in the middle of somebody's work asks once, and
// returns them where they were: the shell moves to sign-in with the sentence
// that says "again", keeps the address the person was standing at and the email
// that session belonged to, and — when the same person signs back in — sends
// them back to that address and reads it again. Nothing about the move revokes
// a cookie this app no longer holds, and nothing about it is decided per screen.
import { loginResponse } from "./fakes/wire";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Text } from "react-native";
import SignInRoute from "../app/sign-in";
import { ResourceRoute } from "../src/route";
import { Shell, useShell, type ShellValue } from "../src/shell";
import { navigations, reset, setParams } from "./fakes/router";

const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
}));
jest.mock("expo-router", () => require("./fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("./fakes/router").reactNavigation);

const KEY = "platformkit.session";
const catalogDoc: unknown = JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
const saved = { version: 1, baseURL: "https://acme.test", cookie: "pk=stale" };
const person = {
  userId: "00000001-1111-4111-8111-111111111111",
  email: "a@acme.test",
  roles: [],
  permissions: [],
};
const routes = {
  me: "GET /api/v1/auth/me",
  resources: "GET /api/v1/app/resources",
  login: "POST /api/v1/auth/login",
  logout: "POST /api/v1/auth/logout",
  list: "GET /api/v1/note/notes",
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
const unauthorized = () => json({ detail: "session expired" }, { status: 401 });
const page = { items: [{ id: "1", title: "Buy milk" }], total: 1 };

/** server is the network as one test allows it: named routes, every call recorded. */
function server(answers: Record<string, () => Response | Promise<Response>>): string[] {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const key = `${init.method ?? "GET"} ${new URL(String(input)).pathname}`;
    calls.push(key);
    const answer = answers[key];
    return answer ? answer() : json({ detail: `no route for ${key}` }, { status: 404 });
  }) as typeof fetch;
  return calls;
}

let latest: ShellValue | undefined;
function Probe() {
  const value = useShell();
  React.useEffect(() => {
    latest = value;
  });
  return <Text testID="phase">{value.state.phase}</Text>;
}

/** Two routes off the same stack, each drawing what it has to say: the list route's
 * guard sends a shell with no session to sign in, and the sign-in route says when it
 * is no longer needed and to where. Neither is asked to stand in for the navigator —
 * the return leg is only proven by the route file that actually walks it. A new
 * `visit` is the person arriving at the list again, which is what asks the question
 * of the session. */
function Journey() {
  return (
    <>
      <ResourceRoute kind="list" />
      <SignInRoute />
    </>
  );
}

const tree = (visit: number) => (
  <Shell baseURL="https://acme.test" renderers={{}}>
    <Probe />
    <Journey key={visit} />
  </Shell>
);

const phase = (expected: string) =>
  waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent(new RegExp(`^${expected}$`)));
const last = () => navigations[navigations.length - 1];
const askedFor = (calls: string[], route: string) => calls.filter((c) => c === route).length;

const realFetch = globalThis.fetch;
beforeEach(() => {
  mockStore.clear();
  latest = undefined;
  reset();
  setParams({ module: "note", entity: "note" });
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("an expired session", () => {
  test("the person is asked once, shown why, and put back where they were", async () => {
    mockStore.set(KEY, JSON.stringify(saved));
    let refusing = false;
    const calls = server({
      [routes.me]: () => json(person),
      [routes.resources]: () => json(catalogDoc),
      [routes.login]: () => loginResponse({ headers: { "Set-Cookie": "pk=fresh; Path=/" } }),
      [routes.list]: () => (refusing ? unauthorized() : json(page)),
    });
    const { rerender } = await render(tree(1));
    await phase("ready");
    await screen.findByTestId("resource-list");
    // The next thing the person does is come back to the list, and the server
    // refuses the session this app was using to read it.
    refusing = true;
    await rerender(tree(2));
    await phase("anonymous");

    // What the move asks, and what it keeps.
    expect(latest?.state.reason).toBe("expired");
    expect(latest?.state.catalog).toBeUndefined();
    expect(latest?.identity).toBeUndefined();
    expect(latest?.returning).toEqual({
      href: "/note/note",
      who: "https://acme.test|00000001-1111-4111-8111-111111111111",
      email: "a@acme.test",
    });
    expect(screen.getByTestId("sign-in-expired")).toHaveTextContent(/Sign in again to continue/);
    expect(screen.getByTestId("email")).toHaveProp("value", "a@acme.test");
    expect(screen.getByTestId("server")).toHaveProp("value", "https://acme.test");
    expect(last()).toBe("/sign-in");
    // A cookie this app no longer holds is not worth a revocation round trip.
    expect(calls).not.toContain(routes.logout);
    // The dead cookie is gone from secure storage; its server stays there.
    await waitFor(() =>
      expect(JSON.parse(mockStore.get(KEY)!)).toEqual({
        version: 1,
        baseURL: "https://acme.test",
      }),
    );

    // Signing in as the same person, at the same server, is the way back.
    refusing = false;
    const before = askedFor(calls, routes.list);
    await act(async () => {
      await latest!.signIn("https://acme.test", "a@acme.test", "pw");
    });
    await phase("ready");
    expect(last()).toBe("/note/note");
    expect(latest?.state.reason).toBeUndefined();
    expect(latest?.identity?.email).toBe("a@acme.test");
    expect(latest?.returning?.href).toBe("/note/note");
    // The screen the person was looking at is read again rather than left blank.
    await waitFor(() => expect(askedFor(calls, routes.list)).toBeGreaterThan(before));
    await screen.findByTestId("resource-list");
  });
});
