// Signing out has two halves, and a phone whose own secure storage refuses to clear has a fact of
// its own to report — before anything the server may owe about the key, because it is a fact about
// the phone. The asking still goes on regardless: taking the key's device row back and stopping the
// key are the server's half, and a full local slot does not make them somebody else's problem. Held
// against the real shell and the real transport, with storage that writes a record carrying no key
// no longer.
import { issuedToken, loginIdentity } from "../fakes/wire";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Shell, useShell, type ShellValue } from "../../src/shell";
import { unresolved } from "../fakes/unresolved";

const NOT_CLEARED =
  "The saved sign-in could not be cleared. Please try again before closing the app.";

const mockStorage = new Map<string, string>();
jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStorage.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    // The record a sign-out leaves behind carries no key. That is the one write this phone
    // cannot make; every write that puts a key on the phone still works.
    if (!JSON.parse(value).token) throw new Error("the keystore is full");
    mockStorage.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStorage.delete(key);
  },
}));

const SERVER = "https://acme.test";
const catalog = unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
const REMOVE =
  "POST /api/v1/notification/notifications/devices/70000000-0000-4000-8000-0000000000d4/remove";
const LOGOUT = "POST /api/v1/auth/logout";

const json = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

/** Every request the phone sent, in order. */
let sent: string[] = [];

function server(): typeof fetch {
  return (async (input: string | URL | Request, init: RequestInit = {}) => {
    const call = `${init.method ?? "GET"} ${new URL(String(input)).pathname}`;
    sent.push(call);
    switch (call) {
      case "POST /api/v1/auth/login":
        return json(loginIdentity, 200, { "Set-Cookie": "platformkit_session=s; Path=/" });
      case "POST /api/v1/auth/tokens":
        return json(issuedToken, 201);
      case `POST /api/v1/auth/tokens/${issuedToken.id}/revoke`:
        return json({ done: true });
      case LOGOUT:
        return json({ signedOut: true });
      case "GET /api/v1/auth/me":
        return json(loginIdentity);
      case "GET /api/v1/app/resources":
        return json(catalog);
      case REMOVE:
        return json({ done: true });
      default:
        return new Response(null, { status: 404 });
    }
  }) as typeof fetch;
}

let latest: ShellValue | undefined;
function Probe() {
  const value = useShell();
  React.useEffect(() => {
    latest = value;
  });
  return null;
}
const shell = (): ShellValue => {
  if (latest === undefined) throw new Error("the shell never rendered its probe");
  return latest;
};
const settle = async (): Promise<void> => {
  await act(async () => await new Promise((done) => setTimeout(done, 0)));
};
const saved = () => JSON.parse(mockStorage.get("platformkit.session") ?? "null");

const originalFetch = globalThis.fetch;
beforeEach(() => {
  latest = undefined;
  sent = [];
  mockStorage.clear();
  globalThis.fetch = server();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("a sign-out whose storage will not clear says so, and still asks the server its half", async () => {
  const app = await render(
    <Shell baseURL={SERVER} renderers={{}}>
      <Probe />
    </Shell>,
  );
  await act(async () => {
    await shell().signIn(SERVER, loginIdentity.email, "hunter2");
  });
  await settle();
  expect(shell().state.phase).toBe("ready");
  expect(saved()).toMatchObject({ baseURL: SERVER, token: issuedToken.token });

  await act(async () => {
    await shell().signOut();
  });
  await settle();

  // What the person reads is about this phone, and it is not the sentence about the key: the
  // server did answer that one.
  expect(shell().state.phase).toBe("anonymous");
  expect(shell().state.error).toBe(NOT_CLEARED);
  // The asking is not held up by a full keystore, and it keeps its order.
  expect(sent).not.toContain(REMOVE);
  expect(sent).toContain(LOGOUT);
  // The key is still standing on the phone — which is exactly why the sentence is owed.
  expect(saved()).toMatchObject({ baseURL: SERVER, token: issuedToken.token });

  await act(async () => app.unmount());
});
