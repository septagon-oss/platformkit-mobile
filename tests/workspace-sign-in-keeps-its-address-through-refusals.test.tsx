// A connection document describes a place without deciding whether anyone can sign in:
// a refused read still signs in at the address shown, a superseded read cannot replace
// the newer place, and a saved sign-in that cannot be read says so on the address step.
import { clock, fakeOutboxStore, fakeReadStore, fakeWorkspaceStore } from "./fakes/store";
import { issuedTokenResponse, loginIdentity, loginResponse } from "./fakes/wire";
import { reset } from "./fakes/router";
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Text } from "react-native";
import { Shell, useShell, type ShellValue } from "../src/shell";
import { SignIn } from "../src/screens/SignIn";
import { WorkspaceTheme } from "../src/screens/WorkspaceTheme";
import { useTheme } from "../src/ui/theme";
import { palette } from "../src/ui/tokens";
import { unresolved } from "./fakes/unresolved";

jest.mock("expo-router", () => require("./fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("./fakes/router").reactNavigation);

const mockSaved = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockSaved.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockSaved.set(key, value);
  },
}));

const catalog: unknown = unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let latest: ShellValue | undefined;
function SessionState() {
  const shell = useShell();
  const theme = useTheme();
  React.useEffect(() => {
    latest = shell;
  });
  return (
    <>
      <Text testID="session-phase">{shell.state.phase}</Text>
      <Text testID="workspace-accent">{theme.color.accentDefault}</Text>
    </>
  );
}

const originalFetch = globalThis.fetch;
let view: Awaited<ReturnType<typeof render>> | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
  globalThis.fetch = originalFetch;
  mockSaved.clear();
  latest = undefined;
  reset();
});

async function phone(baseURL = "") {
  const remembered = fakeWorkspaceStore();
  view = await render(
    <Shell
      baseURL={baseURL}
      renderers={{}}
      store={{
        outbox: fakeOutboxStore().store,
        reads: fakeReadStore().store,
        workspaces: remembered.store,
      }}
      clock={clock("2026-10-19T17:00:00.000Z")}
    >
      <WorkspaceTheme>
        <SessionState />
        <SignIn />
      </WorkspaceTheme>
    </Shell>,
  );
  await waitFor(() => expect(screen.getByTestId("session-phase")).toHaveTextContent("anonymous"));
  return remembered;
}

test("a refused connection read still submits and opens the session at the changed address", async () => {
  const calls: { url: string; headers: Headers; body: unknown }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({
      url,
      headers: new Headers(init.headers),
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    });
    switch (new URL(url).pathname) {
      case "/api/v1/app/connection":
        return json({ title: "Service unavailable", status: 503 }, 503);
      case "/api/v1/auth/login":
        return loginResponse({ headers: { "Set-Cookie": "pk=changed; Path=/; HttpOnly" } });
      case "/api/v1/auth/tokens":
        return issuedTokenResponse();
      case "/api/v1/auth/me":
        return json(loginIdentity);
      case "/api/v1/app/resources":
        return json(catalog);
      default:
        return json({ title: "Not found", status: 404 }, 404);
    }
  }) as typeof fetch;
  const remembered = await phone("https://configured.test");
  await fireEvent.press(screen.getByTestId("change-workspace"));
  await fireEvent.changeText(screen.getByTestId("server"), "https://chosen.test");
  await fireEvent.press(screen.getByTestId("continue"));
  await waitFor(() =>
    expect(screen.getByTestId("workspace-name")).toHaveTextContent("chosen.test"),
  );
  expect(screen.getByTestId("workspace-host")).toHaveTextContent("chosen.test");
  await fireEvent.changeText(screen.getByTestId("email"), loginIdentity.email);
  await fireEvent.changeText(screen.getByTestId("password"), "synthetic-password");
  await fireEvent.press(screen.getByTestId("submit"));
  await waitFor(() => expect(screen.getByTestId("session-phase")).toHaveTextContent("ready"));

  expect(latest?.baseURL).toBe("https://chosen.test");
  expect(latest?.identity?.userId).toBe(loginIdentity.userId);
  expect(calls.every((call) => new URL(call.url).origin === "https://chosen.test")).toBe(true);
  const login = calls.find((call) => new URL(call.url).pathname === "/api/v1/auth/login")!;
  expect(login.body).toEqual({ email: loginIdentity.email, password: "synthetic-password" });
  expect(login.headers.has("Authorization")).toBe(false);
  expect(login.headers.has("Cookie")).toBe(false);
  const connectionReads = calls.filter((call) => call.url.endsWith("/api/v1/app/connection"));
  expect(connectionReads).toHaveLength(2);
  expect(connectionReads[0]!.headers.has("Authorization")).toBe(false);
  expect(connectionReads[0]!.headers.has("Cookie")).toBe(false);
  expect(screen.getByTestId("workspace-accent")).toHaveTextContent(palette.light.accentDefault);
  expect(remembered.rows).toEqual([]);
  expect(JSON.parse(mockSaved.get("platformkit.session")!).baseURL).toBe("https://chosen.test");
});

test("a late successful lookup cannot replace or remember the newer refused workspace", async () => {
  const oldAnswer = Promise.withResolvers<Response>();
  const newAnswer = Promise.withResolvers<Response>();
  globalThis.fetch = (async (input: string | URL | Request) =>
    new URL(String(input)).hostname === "older.test"
      ? oldAnswer.promise
      : newAnswer.promise) as typeof fetch;
  const remembered = await phone();
  let oldRead!: ReturnType<ShellValue["lookUp"]>;
  let newRead!: ReturnType<ShellValue["lookUp"]>;
  await act(async () => {
    oldRead = latest!.lookUp("https://older.test");
    newRead = latest!.lookUp("https://newer.test");
  });
  await act(async () => {
    newAnswer.resolve(json({ title: "Not found", status: 404 }, 404));
    await newRead;
  });
  await act(async () => {
    oldAnswer.resolve(
      json({
        accent: "#7a3cc4",
        accentRatio: { light: 5.59, dark: 2.86 },
        logoUrl: "/api/v1/public/file/files/older-mark",
        methods: { oidc: false, passkey: false, password: true, saml: false },
        name: "Older workspace",
        recovery: { available: false },
        revision: 3,
        signIn: { address: "/api/v1/auth/login" },
        theme: "system",
      }),
    );
    expect(await oldRead).toBeUndefined();
  });
  expect(latest?.workspace).toEqual({ server: "https://newer.test", host: "newer.test", name: "" });
  expect(latest?.state.phase).toBe("anonymous");
  expect(screen.getByTestId("workspace-accent")).toHaveTextContent(palette.light.accentDefault);
  expect(remembered.rows).toEqual([]);
  expect(mockSaved.size).toBe(0);
});

test("an unreadable saved sign-in is visible and can be cleared on the address step", async () => {
  mockSaved.set("platformkit.session", "invalid-record");
  const fetch = jest.fn<typeof globalThis.fetch>();
  globalThis.fetch = fetch;
  await phone();
  expect(screen.getByTestId("server")).toBeOnTheScreen();
  expect(screen.getByTestId("sign-in-notice")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Clear saved sign-in" }));
  await waitFor(() => expect(screen.queryByTestId("sign-in-notice")).toBeNull());
  expect(fetch).not.toHaveBeenCalled();
  expect(JSON.parse(mockSaved.get("platformkit.session")!)).toEqual({ version: 2 });
});
