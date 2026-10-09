// What the person typed survives the sign-in the server forced, and nothing else
// does: a refused write is never sent again on the app's own say-so, the sheet
// that was open comes back with its values, and the sheet is only finished with
// when the write lands. The second case is the "asked once" half: two reads of
// one dead session move the shell once, not twice.
import { loginResponse } from "./fakes/wire";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Text } from "react-native";
import { ResourceRoute } from "../src/route";
import { Shell, useShell, type ShellValue } from "../src/shell";
import { navigations, prevent, reset, setParams } from "./fakes/router";

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

describe("an expired session with a sheet open", () => {
  test("the values stay, the save is not repeated, and pressing Save again is what sends it", async () => {
    mockStore.set(KEY, JSON.stringify(saved));
    setParams({ module: "note", entity: "note", id: "1" });
    let refusing = false;
    const calls = server({
      [routes.me]: () => json(person),
      [routes.resources]: () => json(catalogDoc),
      [routes.row]: () => json(row),
      [routes.login]: () => loginResponse({ headers: { "Set-Cookie": "pk=fresh; Path=/" } }),
      [routes.save]: () => (refusing ? unauthorized() : json({ ...row, title: "Buy twice" })),
    });
    const tree = (visit: number) => (
      <Shell baseURL="https://acme.test" renderers={{}}>
        <Probe />
        <ResourceRoute key={visit} kind="form" withID />
      </Shell>
    );
    await render(tree(1));
    await phase("ready");
    await screen.findByTestId("resource-form");
    expect(screen.getByTestId("input-title")).toHaveProp("value", "Buy milk");

    // The write the person is about to ask for is refused: the session that would
    // have carried it is gone, and the sheet goes with it.
    refusing = true;
    await act(async () => {
      fireEvent.changeText(screen.getByTestId("input-title"), "Buy twice");
    });
    await act(async () => {
      press("save");
    });
    await waitFor(() => expect(askedFor(calls, routes.save)).toBe(1));
    await phase("anonymous");

    expect(latest?.state.reason).toBe("expired");
    expect(latest?.returning?.href).toBe("/note/note/1/edit");
    expect(latest?.typed("/note/note/1/edit")).toEqual({ title: "Buy twice" });
    expect(screen.queryByTestId("resource-form")).toBeNull();
    // Nothing re-sends the refused write while the person is signing in.
    refusing = false;
    await act(async () => {
      await latest!.signIn("https://acme.test", "a@acme.test", "pw");
    });
    expect(askedFor(calls, routes.save)).toBe(1);
    await phase("ready");

    // The sheet comes back as it was left: the typed value in the field, and the
    // guard armed against throwing it away by mistake.
    await screen.findByTestId("resource-form");
    expect(screen.getByTestId("input-title")).toHaveProp("value", "Buy twice");
    await waitFor(() => expect(prevent.enabled).toBe(true));
    expect(askedFor(calls, routes.save)).toBe(1);

    // Pressing Save is what sends it — once — and the sheet is then finished with.
    refusing = false;
    await act(async () => {
      press("save");
    });
    await waitFor(() => expect(askedFor(calls, routes.save)).toBe(2));
    await waitFor(() => expect(latest?.typed("/note/note/1/edit")).toBeUndefined());
  });

  test("two refusals answered by one session move the shell once", async () => {
    mockStore.set(KEY, JSON.stringify(saved));
    setParams({ module: "note", entity: "note" });
    const calls = server({
      [routes.me]: () => (refusing ? unauthorized() : json(person)),
      [routes.resources]: () => (refusing ? unauthorized() : json(catalogDoc)),
    });
    let refusing = false;
    await render(
      <Shell baseURL="https://acme.test" renderers={{}}>
        <Probe />
        <ResourceRoute kind="list" />
      </Shell>,
    );
    await phase("ready");
    const generation = latest?.state.generation;
    const seen = navigations.length;

    // A refresh reads two things, and the session is refused by both.
    refusing = true;
    await act(async () => {
      await latest!.refresh();
    });
    await phase("anonymous");

    // The refresh owns one generation and the move owns the next: two refusals,
    // one move. The first refusal cleared the session, so the second arrived to
    // nothing and wrote nothing — a shell that moved twice would be a person asked
    // twice, and this is the case that says it is not.
    expect(latest?.state.generation).toBe((generation ?? 0) + 2);
    expect(latest?.state.reason).toBe("expired");
    expect(navigations.slice(seen)).toEqual(["/sign-in"]);
    expect(askedFor(calls, routes.me)).toBe(2);
  });
});
