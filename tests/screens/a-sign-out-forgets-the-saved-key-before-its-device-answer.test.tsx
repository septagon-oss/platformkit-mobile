// Signing out forgets the saved key on the phone without waiting for the server: that is the
// half that works offline, and on a phone somebody is about to pick up. Taking the phone's
// device row back is a request like any other, and a slow answer to it must not leave the key
// in storage, where the next launch would open the person's session for whoever holds the
// phone. Held against the real shell, the real transport and the real push bridge, with one
// server whose answer to the device removal the test releases.
import { issuedToken, loginIdentity } from "../fakes/wire";
import { platform, resetPush } from "../fakes/push";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Shell, useShell, type ShellValue } from "../../src/shell";
import { createPush } from "../../src/screens/push";

const mockStorage = new Map<string, string>();
jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStorage.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStorage.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStorage.delete(key);
  },
}));

const SERVER = "https://acme.test";
const catalog = JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
const ROW = "70000000-0000-4000-8000-0000000000d4";
const REGISTER = "POST /api/v1/notification/notifications/devices";
const REMOVE = `POST /api/v1/notification/notifications/devices/${ROW}/remove`;
const LOGOUT = "POST /api/v1/auth/logout";

const json = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

/** Every request the phone sent, in order, and the removal answer the test holds back. */
let sent: string[] = [];
let release: () => void = () => undefined;

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
      case REGISTER:
        return json({
          id: ROW,
          recipientId: loginIdentity.userId,
          platform: "expo",
          token: JSON.parse(String(init.body)).token,
          createdAt: "2026-10-20T06:00:00Z",
          updatedAt: "2026-10-20T06:00:00Z",
        });
      case REMOVE:
        // A slow network: the answer arrives when the test says so.
        await new Promise<void>((done) => (release = done));
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

/** A phone signed in at SERVER whose device row the server holds, and a sign-out pressed on it. */
async function signOutWhileTheRemovalIsAway() {
  platform.permission = true;
  platform.token = "ExponentPushToken[slow-network]";
  const app = await render(
    <Shell baseURL={SERVER} renderers={{}} push={createPush()}>
      <Probe />
    </Shell>,
  );
  await act(async () => {
    await shell().signIn(SERVER, loginIdentity.email, "hunter2");
  });
  await settle();
  expect(shell().state.phase).toBe("ready");
  expect(shell().push.status).toBe("registered");
  expect(saved()).toMatchObject({ baseURL: SERVER, token: issuedToken.token });

  let out: Promise<void> = Promise.resolve();
  await act(async () => {
    out = shell().signOut();
    await new Promise((done) => setTimeout(done, 0));
  });
  await settle();
  expect(shell().state.phase).toBe("anonymous");
  expect(sent).toContain(REMOVE);
  return { app, out };
}

const originalFetch = globalThis.fetch;
beforeEach(() => {
  latest = undefined;
  sent = [];
  release = () => undefined;
  mockStorage.clear();
  resetPush();
  globalThis.fetch = server();
});
afterEach(async () => {
  // A sign-out still parked on the removal finishes against this server, not the real network.
  release();
  await new Promise((done) => setTimeout(done, 0));
  globalThis.fetch = originalFetch;
});

test("a sign-out forgets the saved key while its device row is still being taken back", async () => {
  const { out } = await signOutWhileTheRemovalIsAway();

  expect(saved()).toEqual({ version: 2, baseURL: SERVER });

  await act(async () => {
    release();
    await out;
  });
  await settle();
  expect(sent.indexOf(REMOVE)).toBeLessThan(sent.indexOf(LOGOUT));
  expect(saved()).toEqual({ version: 2, baseURL: SERVER });
});

test("a phone relaunched while sign-out waits for its device answer opens signed out", async () => {
  const { app } = await signOutWhileTheRemovalIsAway();
  // The row is asked back while the key still spends, so the key has not been stopped yet.
  expect(sent).not.toContain(LOGOUT);

  // The person closes the app with the removal still away, and the next person opens it.
  await act(async () => app.unmount());
  latest = undefined;
  sent = [];
  await render(
    <Shell baseURL={SERVER} renderers={{}} push={createPush()}>
      <Probe />
    </Shell>,
  );
  await settle();
  await settle();

  expect(shell().state.phase).toBe("anonymous");
  expect(sent).not.toContain("GET /api/v1/auth/me");
});
