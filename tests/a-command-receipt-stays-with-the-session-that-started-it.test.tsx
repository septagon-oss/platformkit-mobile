// A command may finish after its list unmounts and another tenant signs in. Its receipt belongs
// to the session that sent it; a late response must not file that tenant's words over the next
// person's screen. Keep the real shell, hook and transport in this race.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import type { Entry } from "../src/core/catalog";
import { useRowCommand } from "../src/screens/useCommand";
import { Shell, useShell, type ShellValue } from "../src/shell";
import {
  issuedTokenResponse,
  loginIdentity,
  loginResponse,
  logoutResponse,
  revokeResponse,
} from "./fakes/wire";

const mockSaved = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockSaved.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockSaved.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockSaved.delete(key);
  },
}));
jest.mock("expo-router", () => require("./fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("./fakes/router").reactNavigation);

const catalog = JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
const firstCatalog = {
  ...catalog,
  resources: [
    {
      ...catalog.resources[0],
      presentation: { primaryCommand: "resolve" },
      commands: [
        {
          verb: "resolve",
          summary: "Resolve the note",
          presentation: { successMessage: "The first workspace's note was resolved" },
        },
      ],
    },
  ],
};
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

let latest: ShellValue | undefined;
let runRow: ((id: string) => void) | undefined;

function Rows({ entry }: { entry: Entry }) {
  const { run } = useRowCommand(entry);
  React.useEffect(() => {
    runRow = run;
  }, [run]);
  return null;
}

function Session() {
  const value = useShell();
  React.useEffect(() => {
    latest = value;
  });
  const entry = value.entry("note", "note");
  return value.state.phase === "ready" && entry ? <Rows entry={entry} /> : null;
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  mockSaved.clear();
  latest = undefined;
  runRow = undefined;
});

test("another tenant never receives the receipt of a command still finishing at sign-out", async () => {
  const answer = Promise.withResolvers<Response>();
  const calls: string[] = [];
  const secondUser = "33333333-3333-4333-8333-333333333333";
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    calls.push(`${url.host} ${method} ${url.pathname}`);
    if (method === "POST" && url.pathname === "/api/v1/auth/login")
      return url.hostname === "first.test"
        ? loginResponse({ headers: { "Set-Cookie": "pk=first" } })
        : json(
            { ...loginIdentity, userId: secondUser, email: "second@example.test" },
            { headers: { "Content-Type": "application/json", "Set-Cookie": "pk=second" } },
          );
    if (method === "POST" && url.pathname === "/api/v1/auth/tokens")
      return url.hostname === "first.test"
        ? issuedTokenResponse()
        : issuedTokenResponse(
            {},
            {
              id: "44444444-4444-4444-8444-444444444444",
              token: "pk_live_second_phone",
              createdBy: secondUser,
            },
          );
    if (method === "POST" && url.pathname.endsWith("/revoke")) return revokeResponse();
    if (method === "POST" && url.pathname === "/api/v1/auth/logout") return logoutResponse();
    if (method === "GET" && url.pathname === "/api/v1/auth/me")
      return json({
        ...loginIdentity,
        userId: url.hostname === "second.test" ? secondUser : loginIdentity.userId,
      });
    if (method === "GET" && url.pathname === "/api/v1/app/resources")
      return json(url.hostname === "first.test" ? firstCatalog : catalog);
    if (
      url.hostname === "first.test" &&
      method === "POST" &&
      url.pathname === `${catalog.resources[0].path}/7/resolve`
    )
      return answer.promise;
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  await render(
    <Shell baseURL="https://first.test" renderers={{}}>
      <Session />
    </Shell>,
  );
  await waitFor(() => expect(latest?.state.phase).toBe("anonymous"));
  await act(async () => {
    await latest!.signIn("https://first.test", "first@example.test", "password");
  });
  await waitFor(() => expect(latest?.state.phase).toBe("ready"));
  expect(latest?.identity?.userId).toBe(loginIdentity.userId);
  expect(runRow).toBeDefined();
  await act(async () => runRow!("7"));
  await waitFor(() =>
    expect(calls).toContain(`first.test POST ${catalog.resources[0].path}/7/resolve`),
  );
  await act(async () => {
    await latest!.signOut();
    await latest!.signIn("https://second.test", "second@example.test", "password");
  });
  await waitFor(() => expect(latest?.identity?.userId).toBe(secondUser));
  expect(latest?.baseURL).toBe("https://second.test");
  expect(latest?.reporting()).toBeUndefined();

  await act(async () => {
    answer.resolve(json({ id: "7" }));
    await answer.promise;
  });
  expect(latest?.identity?.userId).toBe(secondUser);
  expect(latest?.reporting()).toBeUndefined();
});
