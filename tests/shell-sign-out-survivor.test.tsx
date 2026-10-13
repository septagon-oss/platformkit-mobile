// Signing out is two acts, and the screen has to tell them apart.
//
// The phone always forgets its key. Whether the server stops it is a second
// question, and at the commit testdata/openapi.source.json pins it has two
// answers: auth-token-revoke is httpx.SignedIn(), and kit/httpx/authorize.go
// refuses a credential that carries its own scopes at every such door, so the key
// a sign-in minted can be spent by the session that opened it, while a key read
// back out of secure storage after a restart has no session left and cannot be.
// The fake below applies those two rules, so the notice is proved against the
// refusal rather than against a server that agrees to everything.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Text } from "react-native";
import { Shell, useShell, type ShellValue } from "../src/shell";
import { SignIn } from "../src/screens/SignIn";
import { kitEnglish } from "../src/core/kitCopy";
import { reset } from "./fakes/router";
import { issuedToken, issuedTokenResponse, loginIdentity } from "./fakes/wire";

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

const catalogDoc: unknown = JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
const sessionCookie = "pk=the-sign-in-that-minted-it";
const savedKey = {
  version: 2,
  baseURL: "https://restored.test",
  token: issuedToken.token,
  tokenId: issuedToken.id,
};
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

/**
 * kernel is the served kernel's two credential rules for the doors this journey
 * reaches: a scoped key is refused wherever the holder's own presence is asked
 * for, and the session that opened with a password is accepted there.
 */
function kernel(seen: string[], sessions: Set<string>) {
  return (async (input: string | URL | Request, init: RequestInit = {}) => {
    const path = new URL(String(input)).pathname;
    const method = init.method ?? "GET";
    seen.push(`${method} ${path}`);
    const headers = new Headers(init.headers);
    const cookie = headers.get("Cookie") ?? "";
    const bearer = headers.get("Authorization") ?? "";
    if (`${method} ${path}` === "POST /api/v1/auth/login") {
      // The password opens a session on the server, which is the credential the
      // mint and every door after it answer to.
      sessions.add(sessionCookie);
      return json(loginIdentity, 200, { "Set-Cookie": `${sessionCookie}; Path=/; HttpOnly` });
    }
    // Every remaining door here is httpx.SignedIn() or the catalogue.
    if (path !== "/api/v1/app/resources" && bearer && !cookie)
      return json(
        {
          status: 403,
          detail:
            "AUTH_DENIED: this credential carries its own scope, and this operation answers only to its holder",
        },
        403,
      );
    if (cookie && !sessions.has(cookie)) return json({ status: 401, detail: "gone" }, 401);
    if (`${method} ${path}` === "POST /api/v1/auth/tokens") return issuedTokenResponse();
    if (`${method} ${path}` === `POST /api/v1/auth/tokens/${issuedToken.id}/revoke`)
      return json({ done: true });
    if (`${method} ${path}` === "POST /api/v1/auth/logout") {
      sessions.delete(cookie);
      return json({ signedOut: true });
    }
    if (`${method} ${path}` === "GET /api/v1/auth/me") return json(loginIdentity);
    if (`${method} ${path}` === "GET /api/v1/app/resources") return json(catalogDoc);
    return json({ status: 404, detail: `no route for ${method} ${path}` }, 404);
  }) as typeof fetch;
}

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

// The notice is drawn by the screen a person reads it on, not by a stand-in:
// SignIn shows the shell's own words as `sign-in-notice`, and the Probe is only
// there to hand the test the phase and the sign-out.
async function mounted(baseURL: string) {
  reset();
  await render(
    <Shell baseURL={baseURL} renderers={{}}>
      <Probe />
      <SignIn />
    </Shell>,
  );
}

test("a phone that signed in here stops its key on the way out and says nothing else", async () => {
  const seen: string[] = [];
  const sessions = new Set<string>();
  globalThis.fetch = kernel(seen, sessions);
  await mounted("https://device.test");
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
  await act(async () => {
    await latest!.signIn("https://device.test", loginIdentity.email, "password");
  });
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("ready"));
  await act(async () => {
    await latest!.signOut();
  });
  await waitFor(() => expect(seen).toContain(`POST /api/v1/auth/tokens/${issuedToken.id}/revoke`));
  expect(screen.getByTestId("phase")).toHaveTextContent("anonymous");
  expect(screen.queryByTestId("sign-in-notice")).toBeNull();
  // The session that minted the key is closed with it, so a sign-out leaves
  // nothing standing on the server that it has just forgotten here.
  expect(seen).toContain("POST /api/v1/auth/logout");
  expect([...sessions]).toEqual([]);
});

test("a phone that restored its key says the server did not stop it", async () => {
  const seen: string[] = [];
  const sessions = new Set<string>(["pk=a-session-from-another-app"]);
  mockStore.set("platformkit.session", JSON.stringify(savedKey));
  globalThis.fetch = kernel(seen, sessions);
  await mounted(savedKey.baseURL);
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("ready"));
  await act(async () => {
    await latest!.signOut();
  });
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
  await waitFor(() => expect(screen.getByText(kitEnglish.keyNotStopped)).toBeTruthy());
  // Nothing was left on the phone, and nothing was closed on the server: the one
  // session still standing there is another app's, which this sign-out has no
  // business touching and no way to reach.
  expect(mockStore.get("platformkit.session")).not.toContain(issuedToken.token);
  expect(seen).not.toContain("POST /api/v1/auth/logout");
  expect([...sessions]).toEqual(["pk=a-session-from-another-app"]);
});
