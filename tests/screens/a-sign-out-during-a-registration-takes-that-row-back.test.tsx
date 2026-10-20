// A sign-out takes back every row the session it ends registered, including the one whose
// registration was still on the wire when the person pressed sign out. The server writes that
// row whether or not the phone is still listening, and only the key being signed out can reach
// it, so it is asked back before that key is spent. Held against the real shell, the real
// transport and the real push bridge, with one server whose register answer the test releases.
import { issuedToken, loginIdentity } from "../fakes/wire";
import { platform, resetPush } from "../fakes/push";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Shell, useShell, type ShellValue } from "../../src/shell";
import { createPush } from "../../src/screens/push";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));

const catalog = JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
const ROW = "70000000-0000-4000-8000-0000000000c3";
const REGISTER = "POST /api/v1/notification/notifications/devices";
const REMOVE = `POST /api/v1/notification/notifications/devices/${ROW}/remove`;
const LOGOUT = "POST /api/v1/auth/logout";

const json = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

/** Every request the phone sent, in order, and the register answer the test holds back. */
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
      case REGISTER: {
        const token = JSON.parse(String(init.body)).token;
        // The server has written the row by the time the phone hears about it.
        await new Promise<void>((done) => (release = done));
        return json({
          id: ROW,
          recipientId: loginIdentity.userId,
          platform: "expo",
          token,
          createdAt: "2026-10-20T03:00:00Z",
          updatedAt: "2026-10-20T03:00:00Z",
        });
      }
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

const originalFetch = globalThis.fetch;
beforeEach(() => {
  latest = undefined;
  sent = [];
  resetPush();
  globalThis.fetch = server();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("a sign-out pressed while the registration is on the wire still takes that row back", async () => {
  platform.permission = true;
  platform.token = "ExponentPushToken[in-flight]";
  await render(
    <Shell baseURL="https://acme.test" renderers={{}} push={createPush()}>
      <Probe />
    </Shell>,
  );
  await act(async () => {
    await shell().signIn("https://acme.test", loginIdentity.email, "hunter2");
  });
  await settle();
  expect(sent).toContain(REGISTER);
  expect(shell().state.phase).toBe("ready");

  // The person signs out before the register answer arrives, and then it arrives.
  let out: Promise<void> = Promise.resolve();
  await act(async () => {
    out = shell().signOut();
    await new Promise((done) => setTimeout(done, 0));
  });
  await act(async () => {
    release();
    await out;
    await new Promise((done) => setTimeout(done, 0));
  });
  await settle();

  expect(sent).toContain(LOGOUT);
  expect(sent).toContain(REMOVE);
  expect(sent.indexOf(REMOVE)).toBeLessThan(sent.indexOf(LOGOUT));
});
