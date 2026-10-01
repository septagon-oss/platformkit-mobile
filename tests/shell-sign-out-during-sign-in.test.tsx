import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Text } from "react-native";
import { Shell, useShell, type ShellValue } from "../src/shell";

const mockSaved = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockSaved.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockSaved.set(key, value);
  },
}));

const catalog = JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
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

test("signing out while a login is pending keeps the app signed out", async () => {
  const login = Promise.withResolvers<Response>();
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const call = `${url.host} ${init.method ?? "GET"} ${url.pathname}`;
    calls.push(call);
    switch (call) {
      case "pending.test POST /api/v1/auth/login":
        return login.promise;
      case "pending.test POST /api/v1/auth/logout":
        return new Response(null, { status: 204 });
      case "pending.test GET /api/v1/auth/me":
        return json({ userId: "pending", email: "pending@example.test" });
      case "pending.test GET /api/v1/app/resources":
        return json(catalog);
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

  let pending!: Promise<void>;
  await act(async () => {
    pending = latest!.signIn("https://pending.test", "pending@example.test", "password");
  });
  await waitFor(() => expect(calls).toContain("pending.test POST /api/v1/auth/login"));

  await act(async () => {
    await latest!.signOut();
  });
  await waitFor(() => expect(screen.getByTestId("session-phase")).toHaveTextContent("anonymous"));

  await act(async () => {
    login.resolve(new Response(null, { status: 204, headers: { "Set-Cookie": "pk=pending" } }));
    await pending;
  });
  expect(screen.getByTestId("session-phase")).toHaveTextContent("anonymous");
  expect(latest?.api.cookie()).toBeUndefined();
  expect(latest?.identity).toBeUndefined();
  expect(latest?.state.catalog).toBeUndefined();
  expect(calls).not.toContain("pending.test GET /api/v1/app/resources");
  expect(calls).not.toContain("pending.test GET /api/v1/auth/me");
  // The login that lost ownership is revoked, and nothing saves its cookie.
  await waitFor(() => expect(calls).toContain("pending.test POST /api/v1/auth/logout"));
  expect(mockSaved.get("platformkit.session") ?? "").not.toContain("pk=pending");
});
