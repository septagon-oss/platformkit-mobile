import { loginResponse } from "./fakes/wire";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Text } from "react-native";
import { Shell, useShell, type ShellValue } from "../src/shell";

const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
}));

const catalog = JSON.parse(readFileSync("testdata/catalog.json", "utf8")) as {
  resources: { module: string; entity: string; path: string }[];
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
    JSON.stringify({ version: 1, baseURL: "https://former.test", cookie: "pk=former" }),
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

  await act(async () => {
    await latest!.signIn("https://current.test", "current@example.test", "password");
  });
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
  expect(latest?.api.cookie()).toBe("pk=current");
  expect(JSON.parse(mockStore.get("platformkit.session")!)).toEqual({
    version: 1,
    baseURL: "https://current.test",
    cookie: "pk=current",
  });
  expect(calls.filter((call) => call.includes("POST") && !call.includes("auth/login"))).toEqual([]);
});
