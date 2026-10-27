// A second factor spends a window one server opened and no other can read. These
// cases hold that address: the code is answered at the origin that refused to
// finish, the key it mints is saved against that origin, and a code with no
// refusal behind it never leaves the phone. The password leg and the transport
// are the ones under test, so the network is a recorder and the store is memory.
import { issuedToken, issuedTokenResponse, loginIdentity, loginResponse } from "./fakes/wire";
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { FACTOR_REQUIRED_DETAIL } from "../src/core/signInOutcome";
import { Shell, useShell, type ShellValue } from "../src/shell";
import { unresolved } from "./fakes/unresolved";

const mockSaved = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockSaved.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockSaved.set(key, value);
  },
}));

const catalogDoc: unknown = unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
const savedRecord = () =>
  JSON.parse(mockSaved.get("platformkit.session") ?? "{}") as Record<string, unknown>;

let latest: ShellValue | undefined;
function SessionState() {
  const value = useShell();
  React.useEffect(() => {
    latest = value;
  });
  return null;
}

interface Call {
  readonly host: string;
  readonly path: string;
}

/**
 * server answers every origin the same way and records which one was asked, so
 * a request that drifted to another tenant's host arrives as a request to a
 * server that never saw this person's password — which is what these cases read.
 * The password "wrong" and the code "000000" are the refusals.
 */
function server(): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
    calls.push({ host: url.host, path: url.pathname });
    const problem = (status: number, detail: string) =>
      new Response(JSON.stringify({ type: "about:blank", status, detail }), {
        status,
        headers: { "Content-Type": "application/problem+json" },
      });
    if (url.pathname === "/api/v1/auth/login")
      return (body as { password?: string }).password === "wrong"
        ? problem(401, "that password is not right")
        : problem(401, FACTOR_REQUIRED_DETAIL);
    if (url.pathname === "/api/v1/auth/challenge/verify")
      return (body as { code?: string }).code === "000000"
        ? problem(401, "that code is not right")
        : loginResponse({ headers: { "Set-Cookie": "pk=factor-session; HttpOnly" } });
    if (url.pathname === "/api/v1/auth/tokens") return issuedTokenResponse();
    if (url.pathname === "/api/v1/auth/me")
      return new Response(JSON.stringify(loginIdentity), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    if (url.pathname === "/api/v1/app/resources")
      return new Response(JSON.stringify(catalogDoc), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    return problem(404, "no route");
  }) as typeof fetch;
  return calls;
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  mockSaved.clear();
  latest = undefined;
});

/** opened signs in to one refusal and returns the calls the phone made. */
async function opened() {
  const calls = server();
  await render(
    <Shell baseURL="https://previous.test" renderers={{}}>
      <SessionState />
    </Shell>,
  );
  await waitFor(() => expect(latest?.state.phase).toBe("anonymous"));
  await act(async () => {
    expect(await latest!.signIn("https://factor.test", loginIdentity.email, "password")).toEqual({
      kind: "factor-required",
      email: loginIdentity.email,
    });
  });
  expect(calls.map((c) => `${c.host}${c.path}`)).toEqual(["factor.test/api/v1/auth/login"]);
  return calls;
}

test("a code that opens the session is answered at the origin that asked for it", async () => {
  const calls = await opened();
  calls.length = 0;
  await act(async () => {
    await latest!.answerFactor(loginIdentity.email, "123456");
  });
  expect(calls.map((c) => `${c.host}${c.path}`)).toEqual([
    "factor.test/api/v1/auth/challenge/verify",
    "factor.test/api/v1/auth/tokens",
    "factor.test/api/v1/auth/me",
    "factor.test/api/v1/app/connection",
    "factor.test/api/v1/app/resources",
  ]);
});

test("the sign-in a code finishes is saved against the server that asked for the code", async () => {
  await opened();
  await act(async () => {
    await latest!.answerFactor(loginIdentity.email, "123456");
  });
  expect(savedRecord()).toEqual({
    version: 2,
    baseURL: "https://factor.test",
    token: issuedToken.token,
    tokenId: issuedToken.id,
  });
  expect(latest?.baseURL).toBe("https://factor.test");
});

test("a newer sign-in owns the challenge the code will answer", async () => {
  const calls = await opened();
  calls.length = 0;
  await act(async () => {
    expect(await latest!.signIn("https://second.test", loginIdentity.email, "password")).toEqual({
      kind: "factor-required",
      email: loginIdentity.email,
    });
  });
  await act(async () => {
    await latest!.answerFactor(loginIdentity.email, "123456");
  });
  expect(calls.map((c) => `${c.host}${c.path}`)).toEqual([
    "second.test/api/v1/auth/login",
    "second.test/api/v1/auth/challenge/verify",
    "second.test/api/v1/auth/tokens",
    "second.test/api/v1/auth/me",
    "second.test/api/v1/app/connection",
    "second.test/api/v1/app/resources",
  ]);
  expect(savedRecord().baseURL).toBe("https://second.test");
});

test("a code with no refusal behind it is refused before any request leaves", async () => {
  const calls = server();
  await render(
    <Shell baseURL="https://previous.test" renderers={{}}>
      <SessionState />
    </Shell>,
  );
  await waitFor(() => expect(latest?.state.phase).toBe("anonymous"));
  calls.length = 0;
  await act(async () => {
    await expect(latest!.answerFactor(loginIdentity.email, "123456")).rejects.toThrow(
      /no code step is open/i,
    );
  });
  expect(calls).toEqual([]);
});

test("signing out closes the challenge a later code cannot answer", async () => {
  const calls = await opened();
  calls.length = 0;
  await act(async () => {
    await latest!.signOut();
  });
  await act(async () => {
    await expect(latest!.answerFactor(loginIdentity.email, "123456")).rejects.toThrow(
      /no code step is open/i,
    );
  });
  expect(calls.filter((c) => c.path === "/api/v1/auth/challenge/verify")).toEqual([]);
});

test("a refused password leaves no challenge for the code step to answer", async () => {
  const calls = await opened();
  calls.length = 0;
  await act(async () => {
    await expect(
      latest!.signIn("https://factor.test", loginIdentity.email, "wrong"),
    ).rejects.toThrow();
  });
  await act(async () => {
    await expect(latest!.answerFactor(loginIdentity.email, "123456")).rejects.toThrow(
      /no code step is open/i,
    );
  });
  expect(calls.map((c) => c.path)).toEqual(["/api/v1/auth/login"]);
});

test("a refused code leaves the same challenge open on the same server", async () => {
  const calls = await opened();
  calls.length = 0;
  await act(async () => {
    await expect(latest!.answerFactor(loginIdentity.email, "000000")).rejects.toThrow();
  });
  const refused = [...calls];
  expect(savedRecord()).toEqual({});
  calls.length = 0;
  await act(async () => {
    await latest!.answerFactor(loginIdentity.email, "123456");
  });
  expect(refused.map((c) => `${c.host}${c.path}`)).toEqual([
    "factor.test/api/v1/auth/challenge/verify",
  ]);
  expect(calls.map((c) => `${c.host}${c.path}`)).toEqual([
    "factor.test/api/v1/auth/challenge/verify",
    "factor.test/api/v1/auth/tokens",
    "factor.test/api/v1/auth/me",
    "factor.test/api/v1/app/connection",
    "factor.test/api/v1/app/resources",
  ]);
});
