import { loginResponse } from "./fakes/wire";
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

let current: ShellValue | undefined;
function SessionState() {
  const value = useShell();
  React.useEffect(() => {
    current = value;
  });
  return <Text testID="session-phase">{value.state.phase}</Text>;
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  mockSaved.clear();
  current = undefined;
});

test("signing in clears the previous identity before login returns", async () => {
  mockSaved.set(
    "platformkit.session",
    JSON.stringify({ version: 1, baseURL: "https://former.test", cookie: "pk=former" }),
  );
  const login = Promise.withResolvers<Response>();
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
        return new Response(null, { status: 503 });
      case "current.test POST /api/v1/auth/login":
        return login.promise;
      case "current.test GET /api/v1/auth/me":
        return json({
          userId: "00000003-1111-4111-8111-111111111111",
          roles: [],
          permissions: [],
          email: "current@example.test",
        });
      case "current.test GET /api/v1/app/resources":
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
  await waitFor(() => expect(screen.getByTestId("session-phase")).toHaveTextContent("failed"));
  await waitFor(() =>
    expect(current?.identity?.userId).toBe("00000002-1111-4111-8111-111111111111"),
  );

  let signIn!: Promise<void>;
  await act(async () => {
    signIn = current!.signIn("https://current.test", "current@example.test", "password");
  });
  await waitFor(() => expect(screen.getByTestId("session-phase")).toHaveTextContent("signing-in"));
  expect(calls).toContain("current.test POST /api/v1/auth/login");
  try {
    expect(current?.identity).toBeUndefined();
  } finally {
    await act(async () => {
      login.resolve(loginResponse({ headers: { "Set-Cookie": "pk=current" } }));
      await signIn;
    });
  }
  await waitFor(() => expect(screen.getByTestId("session-phase")).toHaveTextContent("ready"));
  await waitFor(() =>
    expect(current?.identity?.userId).toBe("00000003-1111-4111-8111-111111111111"),
  );
});
