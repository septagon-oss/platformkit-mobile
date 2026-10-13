// A phone is not a browser: after a sign-in it mints a scoped bearer token
// (auth-token-issue), keeps only that in secure storage and presents it as
// `Authorization: Bearer` on the work it does — never the session cookie the
// login answered with, which is not stored and not what a list or a read is
// answered with.
//
// Signing out revokes that token on the server (auth-token-revoke) and forgets it
// locally, and the revoke is the one request that cannot present the key: at the
// commit testdata/openapi.source.json pins, auth-token-revoke and auth-me are
// httpx.SignedIn(), and kit/httpx/authorize.go refuses a credential carrying its
// own scopes at every such door. The server below enforces that rule, so a revoke
// presented as the key answers 403 here as it does on a served kernel, and the
// session the sign-in opened is what the door takes instead.
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
function server(seen: Seen[], sessions: Set<string>): typeof fetch {
  return (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const call = `${init.method ?? "GET"} ${url.pathname}`;
    const headers = new Headers(init.headers);
    seen.push({ call, headers });
    const cookie = headers.get("Cookie") ?? "";
    const scoped = headers.get("Authorization") !== null;
    const catalogued = call === "GET /api/v1/app/resources";
    if (!catalogued && scoped && !cookie)
      return json(
        {
          status: 403,
          detail:
            "AUTH_DENIED: this credential carries its own scope, and this operation answers only to its holder",
        },
        403,
      );
    if (cookie && !sessions.has(cookie)) return json({ status: 401, detail: "gone" }, 401);
    if (call === "POST /api/v1/auth/login") sessions.add(sessionCookie);
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
        sessions.delete(cookie);
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

async function signedIn(seen: Seen[], sessions = new Set<string>()) {
  globalThis.fetch = server(seen, sessions);
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
  const sessions = new Set<string>();
  await signedIn(seen, sessions);

  await act(async () => {
    await latest!.signOut();
  });
  await waitFor(() => expect(screen.getByTestId("session-phase")).toHaveTextContent("anonymous"));
  await waitFor(() =>
    expect(seen.map((s) => s.call)).toContain(`POST /api/v1/auth/tokens/${tokenId}/revoke`),
  );
  const revoke = seen.find((s) => s.call === `POST /api/v1/auth/tokens/${tokenId}/revoke`)!;
  // The key never opens this door, so the sign-in does: the credential the revoke
  // presents is the session that minted the key, and the key's own secret is not
  // what the address is addressed by. A revoke sent as the key would answer 403
  // here — and did, until this file's server was written to refuse it.
  expect(revoke.headers.get("Cookie")).toBe(sessionCookie);
  expect(revoke.headers.get("Authorization")).toBeNull();
  expect([...mockSaved.values()].join("\n")).not.toContain(bearer);
  // And the session itself does not outlive the sign-out it minted the key with.
  expect(seen.map((s) => s.call)).toContain("POST /api/v1/auth/logout");
  expect([...sessions]).toEqual([]);
});
