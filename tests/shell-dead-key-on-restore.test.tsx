// A key the server no longer recognises — revoked from the account's devices,
// or past the lifetime the mint gave it — is answered the way the kernel answers
// everything it refuses: 403, never 401, with the code it names
// (kit/httpx/authorize.go: "Every refusal is a 403, never a 401"; a bearer that
// buys nobody goes on as anonymous and the door says AUTH_ANONYMOUS). A phone
// that restores such a key has one way out, and the shell owns it: forget the
// key, keep the server, and put the person on the sign-in form with the kit's
// expired words — not on the "could not be opened" screen whose Retry can never
// work.
import { afterEach, expect, jest, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { Shell, useShell, type ShellValue } from "../src/shell";
import { SignIn } from "../src/screens/SignIn";
import { kitEnglish } from "../src/core/kitCopy";
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
  baseURL: "https://restored.test",
  token: issuedToken.token,
  tokenId: issuedToken.id,
};

/** anonymous is the refusal kit/httpx writes for a caller it could not recognise. */
const anonymous = () =>
  new Response(
    JSON.stringify({
      type: "about:blank",
      title: "Forbidden",
      status: 403,
      detail: "AUTH_ANONYMOUS: this operation requires a signed-in caller",
    }),
    { status: 403, headers: { "Content-Type": "application/problem+json" } },
  );

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

test("a restored key the server no longer recognises puts the person on the sign-in form with the expired words", async () => {
  const seen: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const path = new URL(String(input)).pathname;
    seen.push(
      `${init.method ?? "GET"} ${path} ${new Headers(init.headers).get("Authorization") ?? ""}`,
    );
    return anonymous();
  }) as typeof fetch;
  mockStore.set("platformkit.session", JSON.stringify(savedKey));
  reset();
  await render(
    <Shell baseURL={savedKey.baseURL} renderers={{}}>
      <Probe />
      <SignIn />
    </Shell>,
  );
  // The key was presented and refused: that is the whole of what the server said.
  await waitFor(() =>
    expect(seen).toContain(`GET /api/v1/app/resources Bearer ${issuedToken.token}`),
  );
  await waitFor(() => expect(screen.getByTestId("phase")).not.toHaveTextContent(/booting|loading/));
  expect(screen.getByTestId("phase")).toHaveTextContent("anonymous");
  expect(latest?.state.error).toBe(kitEnglish.sessionExpired);
  expect(screen.getByTestId("sign-in")).toBeTruthy();
  expect(JSON.parse(mockStore.get("platformkit.session")!)).toEqual({
    version: 2,
    baseURL: savedKey.baseURL,
  });
  expect(latest?.identity).toBeUndefined();
});
