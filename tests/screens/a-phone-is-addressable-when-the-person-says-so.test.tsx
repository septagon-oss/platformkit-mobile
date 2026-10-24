// A phone is addressable when the person says so, for as long as the sign-in that said it
// lasts. Held against the real shell, the real transport and the real push bridge, with only
// the platform's answers and one server's answers held by the test: what a device row is worth
// is who holds it, when it was written and what sign-out asked back for it — none of which a
// double of the shell could answer for.
import { issuedToken, loginIdentity } from "../fakes/wire";
import { platform, resetPush, tapped } from "../fakes/push";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Shell, useShell, type ShellValue } from "../../src/shell";
import { PushTravel } from "../../src/screens/PushTravel";
import { router } from "../fakes/router";
import { createPush } from "../../src/screens/push";
import { unresolved } from "../fakes/unresolved";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));

const catalog = unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
const REGISTER = "POST /api/v1/notification/notifications/devices";
const REMOVE =
  "POST /api/v1/notification/notifications/devices/70000000-0000-4000-8000-000000000001/remove";
const LOGOUT = "POST /api/v1/auth/logout";
const COOKIE = "platformkit_session=browser-session";
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** deviceRow is one registered phone, printed the way the kernel prints it. */
const deviceRow = (token: string) => ({
  id: "70000000-0000-4000-8000-000000000001",
  recipientId: loginIdentity.userId,
  platform: "expo",
  token,
  createdAt: "2026-10-20T03:00:00Z",
  updatedAt: "2026-10-20T03:00:00Z",
});

interface Answers {
  /** register is what the devices door answers; anything else is its refusal. */
  register?: Response;
  /** removeRefused is the ask for the row that did not answer. */
  removeRefused?: boolean;
  /** revokeRefused is a key the server will not take back, which is what makes it live. */
  revokeRefused?: boolean;
}

/** Every request the phone sent, in the order it sent it. */
let sent: string[] = [];
/** Every register body the phone sent, verbatim. */
let bodies: string[] = [];

/** kernel is the server this phone signs in to, with the three answers a test cares about. */
function kernel(answers: Answers = {}): typeof fetch {
  return (async (input: string | URL | Request, init: RequestInit = {}) => {
    const call = `${init.method ?? "GET"} ${new URL(String(input)).pathname}`;
    sent.push(call);
    if (call === REGISTER && typeof init.body === "string") bodies.push(init.body);
    switch (call) {
      case "POST /api/v1/auth/login":
        // The sign-in's own session rides back as a cookie: the key this phone mints is
        // spent by that session at sign-out, which is the ordering this file reads.
        return new Response(JSON.stringify(loginIdentity), {
          status: 200,
          headers: { "Content-Type": "application/json", "Set-Cookie": `${COOKIE}; Path=/` },
        });
      case "POST /api/v1/auth/tokens":
        return json(issuedToken, 201);
      case `POST /api/v1/auth/tokens/${issuedToken.id}/revoke`:
        return answers.revokeRefused
          ? json({ status: 403, detail: "AUTH_DENIED: a scoped key may not spend itself" }, 403)
          : json({ done: true });
      case LOGOUT:
        return json({ signedOut: true });
      case "GET /api/v1/auth/me":
        return json(loginIdentity);
      case "GET /api/v1/app/resources":
        return json(catalog);
      case REGISTER:
        return answers.register ?? json(deviceRow(JSON.parse(String(init.body)).token));
      case REMOVE:
        return answers.removeRefused
          ? json({ status: 503, detail: "unavailable" }, 503)
          : json({ done: true });
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

/** settle is the notification pass landing: it is not what a sign-in waits for. */
const settle = async (): Promise<void> => {
  await act(async () => await new Promise((done) => setTimeout(done, 0)));
};

const originalFetch = globalThis.fetch;
beforeEach(() => {
  latest = undefined;
  sent = [];
  bodies = [];
  resetPush();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** signedIn is a mounted shell with one sign-in answered and its notification pass run. */
async function signedIn(answers: Answers = {}): Promise<() => ShellValue> {
  globalThis.fetch = kernel(answers);
  await render(
    <Shell baseURL="https://acme.test" renderers={{}} push={createPush()}>
      <Probe />
    </Shell>,
  );
  await act(async () => {
    await (latest as ShellValue)
      .signIn("https://acme.test", loginIdentity.email, "hunter2")
      .catch(() => undefined);
  });
  await settle();
  return () => {
    if (latest === undefined) throw new Error("the shell never rendered its probe");
    return latest;
  };
}

const asked = (call: string): number => sent.filter((c) => c === call).length;
const after = (first: string, then: string): boolean =>
  sent.lastIndexOf(first) < sent.lastIndexOf(then) && sent.lastIndexOf(then) >= 0;

test("a session the platform has never been asked about is offered, and asks nothing", async () => {
  platform.permission = false;
  platform.token = "ExponentPushToken[abc]";
  const shell = await signedIn();
  expect(asked(REGISTER)).toBe(0);
  expect(shell().push.status).toBe("unasked");
  expect(shell().push.offer).toBe(true);
  // The channel exists before anything could be shown, named out of the copy table.
  expect(platform.channels).toEqual(["platformkit=PlatformKit notifications"]);
});

test("a session the platform already permits registers its token once, and again is once", async () => {
  platform.permission = true;
  platform.token = "ExponentPushToken[abc]";
  const shell = await signedIn();
  expect(asked(REGISTER)).toBe(1);
  expect(shell().push.status).toBe("registered");
  expect(shell().push.offer).toBe(false);
  // The token goes verbatim, under the one platform name the push port reserves for it.
  expect(bodies).toEqual(['{"platform":"expo","token":"ExponentPushToken[abc]"}']);
  // Reading the same session again has nothing new to hand over: the same token is one row.
  await act(async () => await shell().refresh());
  expect(asked(REGISTER)).toBe(1);
});

test("a refused registration blocks nothing, and a phone that held no row removes nothing", async () => {
  platform.permission = true;
  platform.token = "ExponentPushToken[abc]";
  const shell = await signedIn({ register: json({ status: 422, detail: "no adapter" }, 422) });
  expect(shell().state.phase).toBe("ready");
  expect(shell().push.status).toBe("refused");
  expect(shell().push.offer).toBe(false);
  await act(async () => await shell().signOut());
  expect(asked(REMOVE)).toBe(0);
});

test("a credential the door will not accept is asked once, not retried", async () => {
  platform.permission = true;
  platform.token = "ExponentPushToken[abc]";
  const shell = await signedIn({ register: json({ status: 403, detail: "denied" }, 403) });
  expect(shell().push.status).toBe("refused");
  await act(async () => await shell().refresh());
  expect(asked(REGISTER)).toBe(1);
});

test("a phone with no push service is unreachable, and its session never notices", async () => {
  platform.permission = true;
  platform.token = undefined;
  const shell = await signedIn();
  expect(asked(REGISTER)).toBe(0);
  expect(shell().push.status).toBe("unreachable");
  expect(shell().state.phase).toBe("ready");
});

test("a token of another kind is no address, and is not sent", async () => {
  platform.permission = true;
  platform.token = "apns-device-token";
  platform.tokenType = "apns";
  const shell = await signedIn();
  expect(asked(REGISTER)).toBe(0);
  expect(shell().push.status).toBe("unreachable");
});

test("sign-out takes the row back before it spends the key", async () => {
  platform.permission = true;
  platform.token = "ExponentPushToken[abc]";
  const shell = await signedIn();
  await act(async () => await shell().signOut());
  expect(asked(REMOVE)).toBe(1);
  expect(after(REGISTER, REMOVE)).toBe(true);
  expect(after(REMOVE, LOGOUT)).toBe(true);
});

test("a sign-out that never held a row asks neither door", async () => {
  platform.permission = false;
  const shell = await signedIn();
  await act(async () => await shell().signOut());
  expect(asked(REMOVE)).toBe(0);
  expect(asked(REGISTER)).toBe(0);
});

test("a row this phone could not take back is said, and only when the key stopped", async () => {
  platform.permission = true;
  platform.token = "ExponentPushToken[abc]";
  const shell = await signedIn({ removeRefused: true });
  await act(async () => await shell().signOut());
  expect(shell().state.error).toContain("could not be removed from your notifications");
});

test("the key is the bigger fact: nothing is said about a row while the key may live", async () => {
  platform.permission = true;
  platform.token = "ExponentPushToken[abc]";
  const shell = await signedIn({ removeRefused: true, revokeRefused: true });
  await act(async () => await shell().signOut());
  expect(shell().state.error).toContain("key could not be revoked");
});

test("a token that changed is held before the old row goes", async () => {
  platform.permission = true;
  platform.token = "ExponentPushToken[first]";
  const shell = await signedIn();
  platform.token = "ExponentPushToken[second]";
  await act(async () => await shell().refresh());
  await settle();
  expect(asked(REGISTER)).toBe(2);
  expect(asked(REMOVE)).toBe(1);
  expect(after(REGISTER, REMOVE)).toBe(true);
});

test("a token answer that arrives after the person signed out registers nothing", async () => {
  platform.permission = true;
  let release: () => void = () => undefined;
  platform.held = new Promise<void>((done) => (release = done));
  const shell = await signedIn();
  expect(shell().push.status).toBe("off");
  await act(async () => await shell().signOut());
  platform.held = undefined;
  await act(async () => {
    release();
    await new Promise((done) => setTimeout(done, 0));
  });
  expect(asked(REGISTER)).toBe(0);
});

test("the prompt is opened by the person's own answer, and once per sign-in", async () => {
  platform.permission = false;
  platform.ask = true;
  platform.token = "ExponentPushToken[abc]";
  const shell = await signedIn();
  expect(platform.asks).toBe(0);
  expect(shell().push.offer).toBe(true);
  await act(async () => await shell().push.turnOn());
  expect(platform.asks).toBe(1);
  expect(asked(REGISTER)).toBe(1);
  expect(shell().push.status).toBe("registered");
});

test("a person who says not now is not asked again in that session", async () => {
  platform.permission = false;
  platform.ask = false;
  const shell = await signedIn();
  await act(async () => shell().push.decline());
  expect(shell().push.offer).toBe(false);
  expect(shell().push.status).toBe("off");
  await act(async () => await shell().refresh());
  expect(shell().push.offer).toBe(false);
  expect(platform.asks).toBe(0);
});

test("a prompt the person answers no to is not asked again, and the session stands", async () => {
  platform.permission = false;
  platform.ask = false;
  const shell = await signedIn();
  await act(async () => await shell().push.turnOn());
  expect(shell().push.status).toBe("refused");
  expect(shell().push.offer).toBe(false);
  expect(shell().state.phase).toBe("ready");
});

test("a tapped notification opens its link through the reading every link gets", async () => {
  platform.tap = tapped("https://platformkit.example/app/note/notes/7");
  await render(<PushTravel />);
  expect(router.replace).toHaveBeenCalledWith("/note/notes/7");
  router.replace.mockClear();
  platform.tap = tapped(undefined);
  await render(<PushTravel />);
  expect(router.replace).not.toHaveBeenCalled();
});
