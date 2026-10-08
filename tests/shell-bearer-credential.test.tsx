// A phone is not a browser: after a sign-in it mints a scoped bearer token
// (auth-token-issue), keeps only that in secure storage and presents it as
// `Authorization: Bearer` — never the session cookie the login answered with.
// Signing out revokes that token on the server (auth-token-revoke) and forgets
// it locally.
import { loginIdentity } from "./fakes/wire";
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
  deleteItemAsync: async (key: string) => {
    mockSaved.delete(key);
  },
}));

const catalog = JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
const identity = { ...loginIdentity, permissions: ["note.read"] };
const sessionCookie = "platformkit_session=browser-session";
const bearer = "pk_live_token_for_this_phone";
const tokenId = "22222222-2222-4222-8222-222222222222";
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

let latest: ShellValue | undefined;
function SessionState() {
  const value = useShell();
  React.useEffect(() => {
    latest = value;
  });
  return <Text testID="session-phase">{value.state.phase}</Text>;
}

type Seen = { call: string; headers: Headers };
function server(seen: Seen[]): typeof fetch {
  return (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const call = `${init.method ?? "GET"} ${url.pathname}`;
    seen.push({ call, headers: new Headers(init.headers) });
    switch (call) {
      case "POST /api/v1/auth/login":
        return json(identity, 200, { "Set-Cookie": `${sessionCookie}; Path=/; HttpOnly` });
      case "POST /api/v1/auth/tokens":
        return json(
          {
            id: tokenId,
            name: "phone",
            createdAt: "2026-10-07T21:00:00Z",
            createdBy: identity.userId,
            expiresAt: "2026-11-06T21:00:00Z",
            lastUsedAt: "2026-10-07T21:00:00Z",
            scopes: identity.permissions,
            token: bearer,
          },
          201,
        );
      case `POST /api/v1/auth/tokens/${tokenId}/revoke`:
        return json({ done: true });
      case "POST /api/v1/auth/logout":
        return json({ signedOut: true });
      case "GET /api/v1/auth/me":
        return json(identity);
      case "GET /api/v1/app/resources":
        return json(catalog);
      default:
        return new Response(null, { status: 404 });
    }
  }) as typeof fetch;
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  mockSaved.clear();
  latest = undefined;
});

async function signedIn(seen: Seen[]) {
  globalThis.fetch = server(seen);
  await render(
    <Shell baseURL="https://acme.test" renderers={{}}>
      <SessionState />
    </Shell>,
  );
  await waitFor(() => expect(screen.getByTestId("session-phase")).toHaveTextContent("anonymous"));
  await act(async () => {
    await latest!.signIn("https://acme.test", identity.email, "password");
  });
  await waitFor(() => expect(screen.getByTestId("session-phase")).toHaveTextContent("ready"));
}

test("a signed-in phone presents the token it minted and never the session cookie", async () => {
  const seen: Seen[] = [];
  await signedIn(seen);

  expect(seen.map((s) => s.call)).toContain("POST /api/v1/auth/tokens");
  const reads = seen.filter((s) => s.call === "GET /api/v1/app/resources");
  expect(reads.length).toBeGreaterThan(0);
  for (const read of reads) {
    expect(read.headers.get("Authorization")).toBe(`Bearer ${bearer}`);
    expect(read.headers.get("Cookie")).toBeNull();
  }
  const kept = [...mockSaved.values()].join("\n");
  expect(kept).toContain(bearer);
  expect(kept).not.toContain("browser-session");
});

test("signing out revokes the token on the server and forgets it locally", async () => {
  const seen: Seen[] = [];
  await signedIn(seen);

  await act(async () => {
    await latest!.signOut();
  });
  await waitFor(() => expect(screen.getByTestId("session-phase")).toHaveTextContent("anonymous"));
  await waitFor(() =>
    expect(seen.map((s) => s.call)).toContain(`POST /api/v1/auth/tokens/${tokenId}/revoke`),
  );
  const revoke = seen.find((s) => s.call === `POST /api/v1/auth/tokens/${tokenId}/revoke`)!;
  expect(revoke.headers.get("Authorization")).toBe(`Bearer ${bearer}`);
  expect([...mockSaved.values()].join("\n")).not.toContain(bearer);
});
