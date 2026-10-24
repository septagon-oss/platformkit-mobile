// A device is registered, and taken back, with the credential its door answers to. The pinned
// API document says which one each door takes (`x-platformkit-auth`): a `signed_in` door answers
// only to the holder, and the kernel refuses it to a credential that carries its own scope
// (kit/httpx/authorize.go: "this credential carries its own scope, and this operation answers
// only to its holder") — which every key this phone mints does. The server below enforces the
// declared kind on every door, so the phone's sign-in itself is held to the same rule.
import { issuedToken, loginIdentity } from "../fakes/wire";
import { platform, resetPush } from "../fakes/push";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Shell, useShell, type ShellValue } from "../../src/shell";
import { createPush } from "../../src/screens/push";
import { unresolved } from "../fakes/unresolved";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));

const catalog = unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
const document = JSON.parse(readFileSync("testdata/openapi.json", "utf8")) as {
  paths: Record<string, Record<string, { "x-platformkit-auth"?: { kind?: string } }>>;
};
const ROW = "70000000-0000-4000-8000-0000000000d4";
const DEVICES = "/api/v1/notification/notifications/devices";
const SESSION = "platformkit_session=holder";

/** kindOf answers the auth kind the pinned document declares for one concrete request. */
function kindOf(method: string, pathname: string): string | undefined {
  for (const [template, operations] of Object.entries(document.paths)) {
    const shape = new RegExp(`^${template.replace(/\{[^}]+\}/g, "[^/]+")}$`);
    if (shape.test(pathname)) return operations[method.toLowerCase()]?.["x-platformkit-auth"]?.kind;
  }
  return undefined;
}

/** Every request, and whether the server let it through its door. */
let doors: { call: string; let: boolean }[] = [];

function kernel(): typeof fetch {
  return (async (input: string | URL | Request, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const { pathname } = new URL(String(input));
    const call = `${method} ${pathname}`;
    const headers = new Headers(init.headers);
    const bearer = headers.get("Authorization");
    const cookie = headers.get("Cookie");
    const kind = kindOf(method, pathname);
    // The phone's key carries its own scope (issuedToken.scopes), so a signed_in door refuses it.
    const refused =
      kind === "signed_in" &&
      cookie !== SESSION &&
      bearer === `Bearer ${issuedToken.token}` &&
      issuedToken.scopes.length > 0;
    doors.push({ call, let: !refused });
    if (refused)
      return new Response(
        JSON.stringify({
          status: 403,
          detail:
            "AUTH_DENIED: this credential carries its own scope, and this operation answers only to its holder",
        }),
        { status: 403, headers: { "Content-Type": "application/problem+json" } },
      );
    const json = (value: unknown, status = 200, extra: Record<string, string> = {}) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json", ...extra },
      });
    switch (call) {
      case "POST /api/v1/auth/login":
        return json(loginIdentity, 200, { "Set-Cookie": `${SESSION}; Path=/` });
      case "POST /api/v1/auth/tokens":
        return json(issuedToken, 201);
      case `POST /api/v1/auth/tokens/${issuedToken.id}/revoke`:
        return json({ done: true });
      case "POST /api/v1/auth/logout":
        return json({ signedOut: true });
      case "GET /api/v1/auth/me":
        return json(loginIdentity);
      case "GET /api/v1/app/resources":
        return json(catalog);
      case `POST ${DEVICES}`:
        return json({
          id: ROW,
          recipientId: loginIdentity.userId,
          platform: "expo",
          token: JSON.parse(String(init.body)).token,
          createdAt: "2026-10-20T03:00:00Z",
          updatedAt: "2026-10-20T03:00:00Z",
        });
      case `POST ${DEVICES}/${ROW}/remove`:
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
const through = (call: string) => doors.filter((d) => d.call === call && d.let).length;

const originalFetch = globalThis.fetch;
beforeEach(() => {
  latest = undefined;
  doors = [];
  resetPush();
  globalThis.fetch = kernel();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("the devices doors let this phone's registration and its removal through", async () => {
  platform.permission = true;
  platform.token = "ExponentPushToken[holder]";
  await render(
    <Shell baseURL="https://acme.test" renderers={{}} push={createPush()}>
      <Probe />
    </Shell>,
  );
  await act(async () => {
    await shell().signIn("https://acme.test", loginIdentity.email, "hunter2");
  });
  await settle();
  // The sign-in itself went through every door it knocked on under the same rule.
  expect(shell().state.phase).toBe("ready");
  expect(through("GET /api/v1/auth/me")).toBeGreaterThan(0);

  expect(kindOf("POST", DEVICES)).toBeDefined();
  expect(through(`POST ${DEVICES}`)).toBe(1);
  expect(shell().push.status).toBe("registered");

  await act(async () => await shell().signOut());
  expect(through(`POST ${DEVICES}/${ROW}/remove`)).toBe(1);
});
