// Revoking a key and closing its minting session are distinct effects. A failed
// session close cannot make the screen say the confirmed key revoke failed.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Shell, useShell, type ShellValue } from "../src/shell";
import { kitEnglish } from "../src/core/kitCopy";
import {
  issuedToken,
  issuedTokenResponse,
  loginIdentity,
  loginResponse,
  revokeResponse,
} from "./fakes/wire";

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

test("a session-close failure does not report a confirmed key revoke as failed", async () => {
  let revoked = false;
  let logoutCalled = false;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/v1/auth/login")
      return loginResponse({ headers: { "Set-Cookie": "pk=holder; HttpOnly" } });
    if (path === "/api/v1/auth/tokens") return issuedTokenResponse();
    if (path === `/api/v1/auth/tokens/${issuedToken.id}/revoke`) {
      revoked = true;
      return revokeResponse();
    }
    if (path === "/api/v1/auth/logout") {
      logoutCalled = true;
      return new Response(
        JSON.stringify({ status: 503, detail: "the session service is unavailable" }),
        { status: 503, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    if (path === "/api/v1/auth/me") return loginResponse();
    if (path === "/api/v1/app/resources")
      return new Response(JSON.stringify({ resources: [] }), {
        headers: { "Content-Type": "application/json" },
      });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  await render(
    <Shell baseURL="https://member.example.test" renderers={{}}>
      <SessionState />
    </Shell>,
  );
  await waitFor(() => expect(latest?.state.phase).toBe("anonymous"));
  await act(async () => {
    await latest!.signIn("https://member.example.test", loginIdentity.email, "password");
  });
  expect(latest?.state.phase).toBe("ready");
  await act(async () => {
    await latest!.signOut();
  });
  expect(revoked).toBe(true);
  expect(logoutCalled).toBe(true);
  expect(latest?.state.phase).toBe("anonymous");
  expect(latest?.api.bearer()).toBeUndefined();
  expect(JSON.parse(mockSaved.get("platformkit.session")!)).not.toHaveProperty("token");
  expect(latest?.state.error).not.toBe(kitEnglish.keyNotStopped);
});
