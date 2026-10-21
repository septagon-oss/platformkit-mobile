// A device row belongs to the sign-in that registered it. When that session ends without a
// sign-out — the server stops recognising the key — the next sign-in, at another workspace or
// as another person, is a new owner of this phone's address: it registers the token with its
// own server, and its sign-out asks that server for that server's row. Held against the real
// shell, the real transport and the real push bridge, with two servers answered by the test.
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
const DEVICES = "/api/v1/notification/notifications/devices";
const FIRST = "https://acme.test";
const SECOND = "https://globex.test";
/** Each server hands out its own row id for the one token this phone has. */
const rowOf: Record<string, string> = {
  "acme.test": "70000000-0000-4000-8000-0000000000a1",
  "globex.test": "70000000-0000-4000-8000-0000000000b2",
};
const other = { ...loginIdentity, userId: "33333333-3333-4333-8333-333333333333" };
const whoAt: Record<string, typeof loginIdentity> = {
  "acme.test": loginIdentity,
  "globex.test": other,
};

const json = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

/** Every request the phone sent, with the host it went to. */
let sent: string[] = [];
/** expired names the host that no longer recognises the key it minted. */
let expired: string | undefined;

function servers(): typeof fetch {
  return (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const call = `${init.method ?? "GET"} ${url.pathname}`;
    sent.push(`${init.method ?? "GET"} ${url.host}${url.pathname}`);
    const who = whoAt[url.host] ?? loginIdentity;
    const row = rowOf[url.host] ?? "";
    switch (call) {
      case "POST /api/v1/auth/login":
        return json(who, 200, { "Set-Cookie": "platformkit_session=s; Path=/" });
      case "POST /api/v1/auth/tokens":
        return json({ ...issuedToken, createdBy: who.userId }, 201);
      case `POST /api/v1/auth/tokens/${issuedToken.id}/revoke`:
        return json({ done: true });
      case "POST /api/v1/auth/logout":
        return json({ signedOut: true });
      case "GET /api/v1/auth/me":
        return expired === url.host ? json({ detail: "session expired" }, 401) : json(who);
      case "GET /api/v1/app/resources":
        return json(catalog);
      case `POST ${DEVICES}`:
        return json({
          id: row,
          recipientId: who.userId,
          platform: "expo",
          token: JSON.parse(String(init.body)).token,
          createdAt: "2026-10-20T03:00:00Z",
          updatedAt: "2026-10-20T03:00:00Z",
        });
      case `POST ${DEVICES}/${row}/remove`:
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
const signIn = async (server: string, who: typeof loginIdentity): Promise<void> => {
  await act(async () => {
    await shell()
      .signIn(server, who.email, "hunter2")
      .catch(() => undefined);
  });
  await settle();
};
const registered = (host: string) => sent.filter((c) => c === `POST ${host}${DEVICES}`).length;

const originalFetch = globalThis.fetch;
beforeEach(() => {
  latest = undefined;
  sent = [];
  expired = undefined;
  resetPush();
  globalThis.fetch = servers();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("a sign-in after a session the server ended registers this phone with its own server", async () => {
  platform.permission = true;
  platform.token = "ExponentPushToken[one-phone]";
  await render(
    <Shell baseURL={FIRST} renderers={{}} push={createPush()}>
      <Probe />
    </Shell>,
  );
  await signIn(FIRST, loginIdentity);
  expect(registered("acme.test")).toBe(1);
  expect(shell().push.status).toBe("registered");

  // The first server stops recognising the key: the session ends without anybody signing out.
  expired = "acme.test";
  await act(async () => await shell().refresh());
  await settle();
  expect(shell().state.phase).not.toBe("ready");

  // Somebody signs in at another workspace on the same phone, with the same push token.
  await signIn(SECOND, other);
  expect(shell().state.phase).toBe("ready");
  expect(registered("globex.test")).toBe(1);

  // Their sign-out asks their own server for the row their own server gave.
  await act(async () => await shell().signOut());
  expect(sent).toContain(`POST globex.test${DEVICES}/${rowOf["globex.test"]}/remove`);
  expect(sent).not.toContain(`POST globex.test${DEVICES}/${rowOf["acme.test"]}/remove`);
});
