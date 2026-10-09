// A response of a session this app stopped using arrives after the person is
// already back in, and changes nothing: the shell has forgotten that session, so
// the refusal it answers describes nobody. Without this, the late answer to a
// request made a minute ago would kick a signed-in person out again.
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
  list: "GET /api/v1/note/notes",
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
const unauthorized = () => json({ detail: "session expired" }, { status: 401 });

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

const phase = (expected: string) =>
  waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent(new RegExp(`^${expected}$`)));

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

describe("a refusal from a session that is already gone", () => {
  test("the person is signed in, the old request answers 401, and nothing moves", async () => {
    // The first read of the first session is still open when everything below it
    // happens — that is the whole point of the case.
    const stale = Promise.withResolvers<Response>();
    let reads = 0;
    globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
      const key = `${init.method ?? "GET"} ${new URL(String(input)).pathname}`;
      // One read stays open, the next is refused, and everything after the
      // sign-in is answered: this case is about one late refusal, not about a
      // server that refuses forever.
      if (key === routes.list) {
        reads++;
        if (reads === 1) return stale.promise;
        return reads === 2 ? unauthorized() : json({ items: [], total: 0 });
      }
      if (key === routes.login)
        return loginResponse({ headers: { "Set-Cookie": "pk=fresh; Path=/" } });
      if (key === routes.me) return json(person);
      return json(catalogDoc);
    }) as typeof fetch;

    const { rerender } = await render(tree(1));
    await phase("ready");

    // The session expires while that read is open, and the same person signs back
    // in: they are back at the list, with a new session.
    await rerender(tree(2));
    await phase("anonymous");
    await act(async () => {
      await latest!.signIn("https://acme.test", "a@acme.test", "pw");
    });
    await phase("ready");
    const settled = {
      generation: latest?.state.generation,
      identity: latest?.identity,
      returning: latest?.returning,
      navigations: navigations.length,
    };

    // And now the request the dead session was making is answered — with a refusal.
    await act(async () => {
      stale.resolve(unauthorized());
    });

    expect(screen.getByTestId("phase")).toHaveTextContent(/^ready$/);
    expect(latest?.state.reason).toBeUndefined();
    expect(latest?.state.generation).toBe(settled.generation);
    expect(latest?.identity).toEqual(settled.identity);
    expect(latest?.returning).toEqual(settled.returning);
    expect(navigations).toHaveLength(settled.navigations);
  });
});
