import { issuedToken, issuedTokenResponse, loginResponse, revokeResponse } from "./fakes/wire";
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Text } from "react-native";
import { Shell, useShell, type ShellValue } from "../src/shell";
import type { SignInStep } from "../src/effects/api";
import { unresolved } from "./fakes/unresolved";

const mockSaved = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockSaved.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockSaved.set(key, value);
  },
}));

const catalog = unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
const laterPath = "/api/v1/note/later-notes";
const laterCatalog = {
  ...catalog,
  resources: [{ ...catalog.resources[0], path: laterPath }],
};
// The key the sign-in that won the race minted. The one that lost minted
// issuedToken, so the two keys and the two ids say which session is in force.
const secondToken = {
  id: "33333333-3333-4333-8333-333333333333",
  token: "pk_live_second_phone",
};
const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

let latest: ShellValue | undefined;
function SessionState() {
  const value = useShell();
  React.useEffect(() => {
    latest = value;
  });
  return <Text testID="session-phase">{value.state.phase}</Text>;
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  mockSaved.clear();
  latest = undefined;
});

test("a late first sign-in cannot replace the second session", async () => {
  const firstLogin = Promise.withResolvers<Response>();
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const call = `${url.host} ${init.method ?? "GET"} ${url.pathname}`;
    calls.push(call);
    switch (call) {
      case "first.test POST /api/v1/auth/login":
        return firstLogin.promise;
      case "first.test POST /api/v1/auth/tokens":
        return issuedTokenResponse();
      case `first.test POST /api/v1/auth/tokens/${issuedToken.id}/revoke`:
        return revokeResponse();
      case "second.test POST /api/v1/auth/login":
        return loginResponse({ headers: { "Set-Cookie": "pk=second" } });
      case "second.test POST /api/v1/auth/tokens":
        return issuedTokenResponse({}, secondToken);
      case "second.test GET /api/v1/auth/me":
        return json({
          userId: "00000004-1111-4111-8111-111111111111",
          roles: [],
          permissions: [],
          email: "second@example.test",
        });
      case "second.test GET /api/v1/app/resources":
        return json(laterCatalog);
      default:
        return new Response(null, { status: 404 });
    }
  }) as typeof fetch;

  await render(
    <Shell baseURL="https://configured.test" renderers={{}}>
      <SessionState />
    </Shell>,
  );
  await waitFor(() => expect(screen.getByTestId("session-phase")).toHaveTextContent("anonymous"));

  let first!: Promise<SignInStep | undefined>;
  await act(async () => {
    first = latest!.signIn("https://first.test", "first@example.test", "password");
  });
  await waitFor(() => expect(calls).toContain("first.test POST /api/v1/auth/login"));

  await act(async () => {
    await latest!.signIn("https://second.test", "second@example.test", "password");
  });
  await waitFor(() => expect(screen.getByTestId("session-phase")).toHaveTextContent("ready"));
  expect(latest?.identity?.userId).toBe("00000004-1111-4111-8111-111111111111");
  expect(latest?.entry("note", "note")?.path).toBe(laterPath);

  await act(async () => {
    firstLogin.resolve(loginResponse({ headers: { "Set-Cookie": "pk=first" } }));
    await first;
  });
  expect(screen.getByTestId("session-phase")).toHaveTextContent("ready");
  expect(latest?.baseURL).toBe("https://second.test");
  expect(latest?.api.bearer()).toEqual(secondToken);
  // The key the superseded attempt learned is taken back rather than left live.
  expect(calls).toContain(`first.test POST /api/v1/auth/tokens/${issuedToken.id}/revoke`);
  expect(latest?.identity?.userId).toBe("00000004-1111-4111-8111-111111111111");
  expect(latest?.entry("note", "note")?.path).toBe(laterPath);
  expect(calls).not.toContain("first.test GET /api/v1/app/resources");
  expect(JSON.parse(mockSaved.get("platformkit.session")!)).toEqual({
    version: 2,
    baseURL: "https://second.test",
    token: secondToken.token,
    tokenId: secondToken.id,
  });
});
