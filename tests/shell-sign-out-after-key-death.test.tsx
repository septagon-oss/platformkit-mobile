// A key the server refused on the way in is a key this phone no longer has — not
// in storage, and not on the connection that carried it either. The sign-out that
// follows a sign-in the person never made has nothing to stop and nobody to send
// to their account's device list: it clears what the phone holds and says nothing
// about a key, because the server had already said it knows no such caller
// (kit/httpx/authorize.go answers a dead bearer at every door as an anonymous
// one — a 403 naming AUTH_ANONYMOUS).
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { Shell, useShell, type ShellValue } from "../src/shell";
import { SignIn } from "../src/screens/SignIn";
import { reset } from "./fakes/router";
import { issuedToken } from "./fakes/wire";

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

const savedKey = {
  version: 2,
  baseURL: "https://expired.test",
  token: issuedToken.token,
  tokenId: issuedToken.id,
};

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

test("signing out after the key died at restore asks the server nothing and says nothing about a key", async () => {
  const seen: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    seen.push(`${init.method ?? "GET"} ${new URL(String(input)).pathname}`);
    return new Response(
      JSON.stringify({
        type: "about:blank",
        title: "Forbidden",
        status: 403,
        detail: "AUTH_ANONYMOUS: this operation requires a signed-in caller",
      }),
      { status: 403, headers: { "Content-Type": "application/problem+json" } },
    );
  }) as typeof fetch;
  mockStore.set("platformkit.session", JSON.stringify(savedKey));
  reset();
  await render(
    <Shell baseURL={savedKey.baseURL} renderers={{}}>
      <Probe />
      <SignIn />
    </Shell>,
  );
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
  // The read that tried to open the saved sign-in is the last request this phone
  // has a credential to make: the connection that carried the dead key is gone.
  const before = seen.length;
  await act(async () => {
    await latest!.signOut();
  });
  expect(latest?.api.bearer()).toBeUndefined();
  expect(seen.slice(before).filter((r) => r.startsWith("POST"))).toEqual([]);
  expect(JSON.parse(mockStore.get("platformkit.session")!)).toEqual({
    version: 2,
    baseURL: savedKey.baseURL,
  });
  expect(screen.getByTestId("phase")).toHaveTextContent("anonymous");
  expect(screen.queryByTestId("sign-in-notice")).toBeNull();
});
