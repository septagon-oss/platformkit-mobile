// A person who has enrolled a second factor is answered "that password is
// right; this account also answers with a second factor" (auth-login, 401).
// The sign-in screen then asks for the code (testIDs `challenge`, `code`,
// `verify`) and sends it to auth-challenge-verify; a wrong code keeps the
// step open. Each case reaches its assertion through the challenge step
// itself, never through the 401 sentence the screen shows today.
import { loginIdentity } from "../fakes/wire";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Shell } from "../../src/shell";
import { SignIn } from "../../src/screens/SignIn";
import { reset } from "../fakes/router";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);

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

const factorRequired = "that password is right; this account also answers with a second factor";
const problem = (status: number, detail: string) =>
  new Response(JSON.stringify({ type: "about:blank", title: "Unauthorized", status, detail }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });

const calls: { call: string; body: string }[] = [];
const originalFetch = globalThis.fetch;
beforeEach(() => {
  reset();
  calls.length = 0;
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const call = `${init.method ?? "GET"} ${url.pathname}`;
    calls.push({ call, body: typeof init.body === "string" ? init.body : "" });
    switch (call) {
      case "POST /api/v1/auth/login":
        return problem(401, factorRequired);
      case "POST /api/v1/auth/challenge/verify":
        return problem(401, "that code is not right");
      default:
        return new Response(null, { status: 404 });
    }
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  mockSaved.clear();
});

async function passwordAccepted() {
  await render(
    <Shell baseURL="https://acme.test" renderers={{}}>
      <SignIn />
    </Shell>,
  );
  await waitFor(() => expect(screen.getByTestId("email")).toBeTruthy());
  fireEvent.changeText(screen.getByTestId("email"), loginIdentity.email);
  fireEvent.changeText(screen.getByTestId("password"), "right password");
  fireEvent.press(screen.getByTestId("submit"));
  await waitFor(() => expect(calls.map((c) => c.call)).toContain("POST /api/v1/auth/login"));
}

test("a factor-required answer opens the code step instead of an error", async () => {
  await passwordAccepted();
  await waitFor(() => expect(screen.getByTestId("challenge")).toBeTruthy());
  expect(screen.getByTestId("code")).toBeTruthy();
});

test("a wrong code is sent to the verify operation and keeps the code step open", async () => {
  await passwordAccepted();
  await waitFor(() => expect(screen.getByTestId("challenge")).toBeTruthy());
  fireEvent.changeText(screen.getByTestId("code"), "000000");
  fireEvent.press(screen.getByTestId("verify"));
  await waitFor(() =>
    expect(calls.map((c) => c.call)).toContain("POST /api/v1/auth/challenge/verify"),
  );
  const verify = calls.find((c) => c.call === "POST /api/v1/auth/challenge/verify")!;
  expect(JSON.parse(verify.body)).toEqual({ email: loginIdentity.email, code: "000000" });
  await waitFor(() => expect(screen.getByTestId("challenge")).toBeTruthy());
  expect(screen.getByTestId("code")).toBeTruthy();
});
