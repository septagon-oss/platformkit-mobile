import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Shell, useShell, type ShellValue } from "../src/shell";
import { loginIdentity } from "./fakes/wire";

const mockSaved = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockSaved.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockSaved.set(key, value);
  },
}));

let latest: ShellValue | undefined;
function SessionState() {
  const value = useShell();
  React.useEffect(() => {
    latest = value;
  });
  return null;
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  mockSaved.clear();
  latest = undefined;
});

test("the second factor is sent only to the server that accepted the password", async () => {
  const calls: { url: string; body: unknown }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(
      JSON.stringify({
        type: "about:blank",
        status: 401,
        detail: url.endsWith("/login")
          ? "that password is right; this account also answers with a second factor"
          : "that code is not right",
      }),
      { status: 401, headers: { "Content-Type": "application/problem+json" } },
    );
  }) as typeof fetch;
  await render(
    <Shell baseURL="https://previous.test" renderers={{}}>
      <SessionState />
    </Shell>,
  );
  await waitFor(() => expect(latest?.state.phase).toBe("anonymous"));
  await act(async () => {
    expect(await latest!.signIn("https://selected.test", loginIdentity.email, "password")).toEqual({
      kind: "factor-required",
      email: loginIdentity.email,
    });
  });
  await act(async () => {
    await expect(latest!.answerFactor(loginIdentity.email, "123456")).rejects.toMatchObject({
      status: 401,
    });
  });
  expect(calls).toEqual([
    {
      url: "https://selected.test/api/v1/auth/login",
      body: { email: loginIdentity.email, password: "password" },
    },
    {
      url: "https://selected.test/api/v1/auth/challenge/verify",
      body: { email: loginIdentity.email, code: "123456" },
    },
  ]);
  expect([...mockSaved.values()].join("\n")).not.toContain("token");
});
