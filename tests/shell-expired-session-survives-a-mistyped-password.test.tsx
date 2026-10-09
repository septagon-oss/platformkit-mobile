// A mistyped password is part of signing back in, not the end of it: the first
// attempt the server refuses leaves the person on sign-in (brief item 5), and the
// attempt that succeeds as the same person still returns them to the sheet they
// were on with what they typed (brief items 2 and 3).
import { loginResponse } from "./fakes/wire";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Text } from "react-native";
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
  row: "GET /api/v1/note/notes/1",
  save: "PATCH /api/v1/note/notes/1",
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
const unauthorized = () => json({ detail: "session expired" }, { status: 401 });
const row = { id: "1", title: "Buy milk" };

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

const phase = (expected: string) =>
  waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent(new RegExp(`^${expected}$`)));
const askedFor = (calls: string[], route: string) => calls.filter((c) => c === route).length;
const press = (id: string) => fireEvent.press(screen.getByTestId(id));

const realFetch = globalThis.fetch;
beforeEach(() => {
  mockStore.clear();
  latest = undefined;
  reset();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("an expired session, a mistyped password, then the right one", () => {
  test("the same person still returns to the sheet with what they typed", async () => {
    mockStore.set(KEY, JSON.stringify(saved));
    setParams({ module: "note", entity: "note", id: "1" });
    let refusing = false;
    let password = "right";
    const calls = server({
      [routes.me]: () => json(person),
      [routes.resources]: () => json(catalogDoc),
      [routes.row]: () => json(row),
      [routes.login]: () =>
        password === "right"
          ? loginResponse({ headers: { "Set-Cookie": "pk=fresh; Path=/" } })
          : json({ detail: "invalid credentials" }, { status: 401 }),
      [routes.save]: () => (refusing ? unauthorized() : json({ ...row, title: "Buy twice" })),
    });
    await render(
      <Shell baseURL="https://acme.test" renderers={{}}>
        <Probe />
        <ResourceRoute kind="form" withID />
      </Shell>,
    );
    await phase("ready");
    await screen.findByTestId("resource-form");

    refusing = true;
    await act(async () => {
      fireEvent.changeText(screen.getByTestId("input-title"), "Buy twice");
    });
    await act(async () => {
      press("save");
    });
    await phase("anonymous");
    expect(latest?.state.reason).toBe("expired");

    // The first attempt is refused: the person stays on sign-in.
    password = "wrong";
    let failed = false;
    await act(async () => {
      await latest!.signIn("https://acme.test", "a@acme.test", "wrong").catch(() => {
        failed = true;
      });
    });
    expect(failed).toBe(true);
    await phase("anonymous");

    // The second attempt is the same person at the same server.
    password = "right";
    refusing = false;
    const seen = navigations.length;
    await act(async () => {
      await latest!.signIn("https://acme.test", "a@acme.test", "right");
    });
    await phase("ready");

    expect(latest?.typed("/note/note/1/edit")).toEqual({ title: "Buy twice" });
    await screen.findByTestId("resource-form");
    expect(screen.getByTestId("input-title")).toHaveProp("value", "Buy twice");
    expect(navigations.slice(seen)).not.toContain("/");
    expect(askedFor(calls, routes.save)).toBe(1);
  });
});
