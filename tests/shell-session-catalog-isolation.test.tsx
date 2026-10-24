import { issuedToken, issuedTokenResponse, loginResponse } from "./fakes/wire";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Text } from "react-native";
import { Shell, useShell, type ShellValue } from "../src/shell";
import type { SignInStep } from "../src/effects/api";
import { unresolved } from "./fakes/unresolved";

const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
}));

const catalog = unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8"))) as {
  resources: { module: string; entity: string; path: string }[];
};
// What the store holds once this sign-in minted its key: the key, its id, its
// server, and nothing the login's answer carried.
const minted = {
  version: 2,
  baseURL: "https://current.test",
  token: issuedToken.token,
  tokenId: issuedToken.id,
};
const currentPath = "/api/v1/note/current-notes";
const currentCatalog = {
  ...catalog,
  resources: [{ ...catalog.resources[0], path: currentPath }],
};
const json = (value: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

let latest: ShellValue | undefined;
function CurrentSession() {
  const value = useShell();
  React.useEffect(() => {
    latest = value;
  });
  return (
    <Text testID="session">{`${value.state.phase}:${value.entry("note", "note")?.path ?? "none"}`}</Text>
  );
}

const originalFetch = globalThis.fetch;
beforeEach(() => {
  latest = undefined;
  mockStore.clear();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("an obsolete session catalog cannot replace a newer session catalog", async () => {
  mockStore.set(
    "platformkit.session",
    JSON.stringify({
      version: 2,
      baseURL: "https://former.test",
      token: "pk_live_former",
      tokenId: "00000000-0000-4000-8000-000000000002",
    }),
  );
  const formerCatalog = Promise.withResolvers<Response>();
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const call = `${url.host} ${init.method ?? "GET"} ${url.pathname}`;
    calls.push(call);
    switch (call) {
      case "former.test GET /api/v1/auth/me":
        return json({
          userId: "00000002-1111-4111-8111-111111111111",
          roles: [],
          permissions: [],
          email: "former@example.test",
        });
      case "former.test GET /api/v1/app/resources":
        return formerCatalog.promise;
      case "current.test POST /api/v1/auth/login":
        return loginResponse({ headers: { "Set-Cookie": "pk=current" } });
      case "current.test POST /api/v1/auth/tokens":
        return issuedTokenResponse();
      case "current.test GET /api/v1/auth/me":
        return json({
          userId: "00000003-1111-4111-8111-111111111111",
          roles: [],
          permissions: [],
          email: "current@example.test",
        });
      case "current.test GET /api/v1/app/resources":
        return json(currentCatalog);
      default:
        return json({ detail: `unexpected ${call}` }, { status: 404 });
    }
  }) as typeof fetch;

  await render(
    <Shell baseURL="https://configured.test" renderers={{}}>
      <CurrentSession />
    </Shell>,
  );
  await waitFor(() => expect(calls).toContain("former.test GET /api/v1/app/resources"));
  expect(screen.getByTestId("session")).toHaveTextContent("loading:none");

  let step: SignInStep | undefined;
  await act(async () => {
    step = await latest!.signIn("https://current.test", "current@example.test", "password");
  });
  expect(step).toEqual({ kind: "signed-in" });
  await waitFor(() =>
    expect(screen.getByTestId("session")).toHaveTextContent(`ready:${currentPath}`),
  );
  expect(latest?.identity?.userId).toBe("00000003-1111-4111-8111-111111111111");

  await act(async () => {
    formerCatalog.resolve(json(catalog));
    await formerCatalog.promise;
  });
  expect(screen.getByTestId("session")).toHaveTextContent(`ready:${currentPath}`);
  expect(latest?.identity?.userId).toBe("00000003-1111-4111-8111-111111111111");
  expect(latest?.api.bearer()).toEqual({ token: issuedToken.token, id: issuedToken.id });
  expect(JSON.parse(mockStore.get("platformkit.session")!)).toEqual(minted);
  // The only writes this journey made are the sign-in and the mint that bought
  // its key: nothing was revoked on the server just signed in to, and the
  // obsolete catalog's late answer changed nothing on this one.
  expect(calls.filter((call) => call.includes("POST"))).toEqual([
    "current.test POST /api/v1/auth/login",
    "current.test POST /api/v1/auth/tokens",
  ]);
});
