// A sign-out has two halves, and the notice about the second one is owed only
// when there was a key to stop. A phone that holds no key — a saved record it
// could not read, cleared from the sign-in form's own "Clear saved sign-in" —
// sends no revoke and has nothing the server could have refused, so the screen
// it lands on says nothing about a key: there is no device for the person to go
// and remove from their account.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { Shell, useShell, type ShellValue } from "../src/shell";
import { SignIn } from "../src/screens/SignIn";
import { reset } from "./fakes/router";

jest.mock("expo-router", () => require("./fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("./fakes/router").reactNavigation);

const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
  },
}));

let latest: ShellValue | undefined;
function Probe() {
  const value = useShell();
  React.useEffect(() => {
    latest = value;
  });
  return <Text testID="phase">{value.state.phase}</Text>;
}
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  mockStore.clear();
  latest = undefined;
});

test("clearing a saved sign-in this phone could not read says nothing about a key", async () => {
  const seen: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    seen.push(`${init.method ?? "GET"} ${new URL(String(input)).pathname}`);
    return new Response(JSON.stringify({ status: 404 }), {
      status: 404,
      headers: { "Content-Type": "application/problem+json" },
    });
  }) as typeof fetch;
  mockStore.set("platformkit.session", "not a record");
  reset();
  await render(
    <Shell baseURL="https://device.test" renderers={{}}>
      <Probe />
      <SignIn />
    </Shell>,
  );
  // The way in: the form offers "Clear saved sign-in" under the shell's notice
  // about the record it could not read.
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
  await waitFor(() => expect(screen.getByTestId("sign-in-notice")).toBeTruthy());
  await act(async () => {
    await latest!.signOut();
  });
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
  // Nothing held, nothing asked: no revoke left the phone, the record is the
  // server alone, and the form stands with no notice at all.
  expect(seen).toEqual([]);
  expect(JSON.parse(mockStore.get("platformkit.session")!)).toEqual({
    version: 2,
    baseURL: "https://device.test",
  });
  expect(latest?.state.error).toBeUndefined();
  expect(screen.queryByTestId("sign-in-notice")).toBeNull();
});

test("signing out while a sign-in is still pending says nothing about a key", async () => {
  const login = Promise.withResolvers<Response>();
  globalThis.fetch = (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/v1/auth/login") return login.promise;
    return new Response(JSON.stringify({ status: 404 }), {
      status: 404,
      headers: { "Content-Type": "application/problem+json" },
    });
  }) as typeof fetch;
  reset();
  await render(
    <Shell baseURL="https://device.test" renderers={{}}>
      <Probe />
      <SignIn />
    </Shell>,
  );
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = latest!.signIn("https://device.test", "member@example.test", "password");
  });
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("signing-in"));
  // The connection being signed out is the one that was active before the
  // attempt: it never held a key, so there is none the server could refuse.
  await act(async () => {
    await latest!.signOut();
  });
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
  expect(latest?.state.error).toBeUndefined();
  expect(screen.queryByTestId("sign-in-notice")).toBeNull();
  // Let the superseded attempt finish so nothing outlives the test.
  await act(async () => {
    login.resolve(
      new Response(JSON.stringify({ status: 401, detail: "gone" }), {
        status: 401,
        headers: { "Content-Type": "application/problem+json" },
      }),
    );
    await pending.catch(() => undefined);
  });
});

test("signing out of a restored key the server already refused says nothing about a key", async () => {
  // The kernel refuses a key it no longer recognises as an anonymous caller
  // (kit/httpx/authorize.go: 403, AUTH_ANONYMOUS), at every door including the
  // revoke. There is no live key anywhere for the person to go and remove.
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        type: "about:blank",
        title: "Forbidden",
        status: 403,
        detail: "AUTH_ANONYMOUS: this operation requires a signed-in caller",
      }),
      { status: 403, headers: { "Content-Type": "application/problem+json" } },
    )) as typeof fetch;
  mockStore.set(
    "platformkit.session",
    JSON.stringify({
      version: 2,
      baseURL: "https://device.test",
      token: "pk_live_stopped",
      tokenId: "22222222-2222-4222-8222-222222222222",
    }),
  );
  reset();
  await render(
    <Shell baseURL="https://device.test" renderers={{}}>
      <Probe />
      <SignIn />
    </Shell>,
  );
  // The restore has been answered, whichever way the shell reads that answer.
  await waitFor(() => expect(screen.getByTestId("phase")).not.toHaveTextContent(/booting|loading/));
  await act(async () => {
    await latest!.signOut();
  });
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
  expect(JSON.parse(mockStore.get("platformkit.session")!)).toEqual({
    version: 2,
    baseURL: "https://device.test",
  });
  expect(latest?.state.error).toBeUndefined();
  expect(screen.queryByTestId("sign-in-notice")).toBeNull();
});
