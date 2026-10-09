// Whoever signs in next is not necessarily the person whose session expired, and
// what that person left behind does not cross: a different identity lands on Home
// with no remembered route, no held sheet and no write counts — and the drop
// happens before the catalogue is ready, so no render shows what they never wrote.
// A session that cannot say who it is inherits nothing either.
import { loginIdentity, loginResponse } from "./fakes/wire";
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
const former = {
  userId: "00000001-1111-4111-8111-111111111111",
  email: "a@acme.test",
  roles: [],
  permissions: [],
};
const routes = {
  me: "GET /api/v1/auth/me",
  resources: "GET /api/v1/app/resources",
  login: "POST /api/v1/auth/login",
  list: "GET /api/v1/note/notes",
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
const unauthorized = () =>
  new Response(JSON.stringify({ detail: "session expired" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

function server(answers: Record<string, () => Response | Promise<Response>>): string[] {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const key = `${init.method ?? "GET"} ${new URL(String(input)).pathname}`;
    calls.push(key);
    const answer = answers[key];
    return answer ? answer() : json({ detail: "no route" });
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

const tree = (visit: number) => (
  <Shell baseURL="https://acme.test" renderers={{}}>
    <Probe />
    <ResourceRoute key={visit} kind="list" />
    <SignInRoute />
  </Shell>
);

/** answering replaces the network for the leg after the sign-in: one identity,
 * answered wherever the person signs in, with a fresh cookie for every server. */
function answering(who: unknown): void {
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const key = `${init.method ?? "GET"} ${new URL(String(input)).pathname}`;
    if (key === routes.login) return loginResponse({ headers: { "Set-Cookie": "pk=new; Path=/" } });
    if (key === routes.me) return json(who);
    return json(catalogDoc);
  }) as typeof fetch;
}

const phase = (expected: string) =>
  waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent(new RegExp(`^${expected}$`)));
const last = () => navigations[navigations.length - 1];

const realFetch = globalThis.fetch;
beforeEach(() => {
  mockStore.set(KEY, JSON.stringify(saved));
  latest = undefined;
  reset();
  setParams({ module: "note", entity: "note" });
});
afterEach(() => {
  globalThis.fetch = realFetch;
  mockStore.clear();
});

/** The person is at the list, typing, and counting what this app wrote — then the
 * server refuses the session. Returns the generation the move left behind. */
async function loseTheSession(who: unknown) {
  let refusing = false;
  const calls = server({
    [routes.me]: () => json(who),
    [routes.resources]: () => json(catalogDoc),
    [routes.login]: () => loginResponse({ headers: { "Set-Cookie": "pk=fresh; Path=/" } }),
    [routes.list]: () => (refusing ? unauthorized() : json({ items: [], total: 0 })),
  });
  const { rerender } = await render(tree(1));
  await phase("ready");
  await act(async () => {
    latest!.wrote("note/note");
    latest!.keep("/note/note/1/edit", { title: "a private draft" });
  });
  refusing = true;
  await rerender(tree(2));
  await phase("anonymous");
  expect(latest?.returning?.email).toBe(former.email);
  return calls;
}

describe("a re-authentication by someone else", () => {
  test("another identity lands on Home with nothing of the previous person's", async () => {
    await loseTheSession(former);
    answering(loginIdentity);

    await act(async () => {
      await latest!.signIn("https://acme.test", loginIdentity.email, "pw");
    });
    await phase("ready");

    expect(last()).toBe("/");
    expect(latest?.identity?.userId).toBe(loginIdentity.userId);
    expect(latest?.returning).toBeUndefined();
    expect(latest?.typed("/note/note/1/edit")).toBeUndefined();
    // Counted on the first ready render, not corrected afterwards.
    expect(latest?.writes).toEqual({});
  });

  test("the same user id at another server is another person, and inherits nothing", async () => {
    await loseTheSession(former);
    answering(former);

    await act(async () => {
      await latest!.signIn("https://other.test", former.email, "pw");
    });
    await phase("ready");

    // The binding is the server that made the session and the user id it named,
    // so a session made at acme.test never hands its landing page or its draft to
    // a sign-in answered by another server — even for one user id.
    expect(last()).toBe("/");
    expect(latest?.identity?.userId).toBe(former.userId);
    expect(latest?.returning).toBeUndefined();
    expect(latest?.typed("/note/note/1/edit")).toBeUndefined();
    expect(latest?.writes).toEqual({});
  });
});
