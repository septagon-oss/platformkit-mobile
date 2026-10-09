// A response of a session this app stopped using arrives after the person is
// already back in, and changes nothing: the shell has forgotten that session, so
// the refusal it answers describes nobody. Without this, the late answer to a
// request made a minute ago would kick a signed-in person out again. The second
// case is the same rule one refusal earlier, and it is the one that pins the
// forgetting itself: a session refused twice must have been cleared the first
// time, because the second answer would otherwise write to storage, spend a
// generation and leave a gap before the sign-in that follows.
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
/** storedRecords is every record the app handed secure storage, oldest first. A
 * clear keeps the server and drops the cookie; a save carries one. */
const storedRecords: string[] = [];
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
    storedRecords.push(value);
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
const last = () => navigations[navigations.length - 1];
/** clearedStorage counts the writes that dropped a cookie and kept the server —
 * what one dead session is asked to do exactly once. */
const clearedStorage = () =>
  storedRecords.filter((record) => !(JSON.parse(record) as { cookie?: string }).cookie).length;

const realFetch = globalThis.fetch;
beforeEach(() => {
  mockStore.set(KEY, JSON.stringify(saved));
  storedRecords.length = 0;
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

  test("a second refusal from one dead session clears nothing, spends nothing and moves nobody", async () => {
    // A refresh reads two things, and the session is refused by both. The first
    // answer ends the session; the second describes one the shell has already
    // forgotten. "Asked once" is only pinned if the second answer is watched for
    // what it would leave behind: a second write to secure storage, a generation
    // spent on a move nobody was asked for, and a gap before the sign-in that
    // follows — which is what the person would pay for it.
    const refused = [Promise.withResolvers<Response>(), Promise.withResolvers<Response>()];
    const reads = { identity: 0, catalog: 0 };
    const calls: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
      const key = `${init.method ?? "GET"} ${new URL(String(input)).pathname}`;
      calls.push(key);
      // One refresh reads both, and both are refused; everything after the
      // sign-in is answered, because this case is about the second refusal and not
      // about a server that refuses forever.
      if (key === routes.me) {
        reads.identity++;
        return reads.identity === 2 ? refused[0]!.promise : json(person);
      }
      if (key === routes.resources) {
        reads.catalog++;
        return reads.catalog === 2 ? refused[1]!.promise : json(catalogDoc);
      }
      if (key === routes.login)
        return loginResponse({ headers: { "Set-Cookie": "pk=fresh; Path=/" } });
      return json({ items: [], total: 0 });
    }) as typeof fetch;

    await render(tree(1));
    await phase("ready");

    // A refresh reads two things with the session that is about to be refused.
    await act(async () => {
      void latest!.refresh();
    });
    // The first refusal ends the session: the person is asked, and the dead cookie
    // is on its way out of storage.
    await act(async () => {
      refused[0]!.resolve(unauthorized());
    });
    await phase("anonymous");
    await waitFor(() => expect(reads).toEqual({ identity: 2, catalog: 2 }));
    expect(latest?.state.reason).toBe("expired");
    const moved = latest?.state.generation;
    const asked = navigations.length;
    await waitFor(() => expect(clearedStorage()).toBe(1));

    // And the same session answers its second read with the same refusal.
    await act(async () => {
      refused[1]!.resolve(unauthorized());
      // That clear is a queued, fire-and-forget write; a turn of the loop is what
      // shows a second one was never queued.
      await new Promise((next) => setTimeout(next, 0));
    });
    expect(clearedStorage()).toBe(1);
    expect(latest?.state.reason).toBe("expired");
    expect(latest?.state.generation).toBe(moved);
    expect(navigations).toHaveLength(asked);

    // The person signs back in as themselves. That sign-in owns the generation
    // straight after the move, which is only true if the second refusal spent
    // nothing on a move of its own, and it ends with the person back where they
    // were and no session revoked.
    await act(async () => {
      await latest!.signIn("https://acme.test", "a@acme.test", "pw");
    });
    await phase("ready");
    expect(latest?.state.generation).toBe((moved ?? 0) + 1);
    expect(calls).not.toContain(routes.logout);
    expect(latest?.state.reason).toBeUndefined();
    expect(latest?.returning?.href).toBe("/note/note");
    expect(last()).toBe("/note/note");
    expect(clearedStorage()).toBe(1);
  });
});
