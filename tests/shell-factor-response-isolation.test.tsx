// A factor response belongs to the attempt that sent it. A late refusal must
// leave the key, storage and catalog of a newer accepted answer intact.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Shell, useShell, type ShellValue } from "../src/shell";
import { SignIn } from "../src/screens/SignIn";
import { reset } from "./fakes/router";
import { FACTOR_REQUIRED_DETAIL } from "../src/core/signInOutcome";
import {
  issuedToken,
  issuedTokenResponse,
  loginIdentity,
  loginResponse,
  logoutResponse,
  revokeResponse,
} from "./fakes/wire";

jest.mock("expo-router", () => require("./fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("./fakes/router").reactNavigation);

const mockSaved = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockSaved.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockSaved.set(key, value);
  },
}));

let latest: ShellValue | undefined;
function SessionState() {
  const value = useShell();
  React.useEffect(() => {
    latest = value;
  });
  return null;
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  mockSaved.clear();
  latest = undefined;
});

const problem = (detail: string) =>
  new Response(JSON.stringify({ type: "about:blank", status: 401, detail }), {
    status: 401,
    headers: { "Content-Type": "application/problem+json" },
  });

test("a late refused factor leaves a newer accepted factor's key usable", async () => {
  const refused = Promise.withResolvers<Response>();
  const revocations: string[] = [];
  let verifies = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/v1/auth/login") return problem(FACTOR_REQUIRED_DETAIL);
    if (path === "/api/v1/auth/challenge/verify") {
      verifies++;
      return verifies === 1
        ? refused.promise
        : loginResponse({ headers: { "Set-Cookie": "pk=accepted-factor; HttpOnly" } });
    }
    if (path === "/api/v1/auth/tokens") return issuedTokenResponse();
    if (path.endsWith("/revoke")) {
      revocations.push(path);
      return revokeResponse();
    }
    if (path === "/api/v1/auth/logout") return logoutResponse();
    if (path === "/api/v1/auth/me") return loginResponse();
    if (path === "/api/v1/app/resources")
      return new Response(JSON.stringify({ resources: [] }), {
        headers: { "Content-Type": "application/json" },
      });
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  await render(
    <Shell baseURL="https://factor.example.test" renderers={{}}>
      <SessionState />
    </Shell>,
  );
  await waitFor(() => expect(latest?.state.phase).toBe("anonymous"));
  await act(async () => {
    await latest!.signIn("https://factor.example.test", loginIdentity.email, "password");
  });
  let first!: Promise<void>;
  await act(async () => {
    first = latest!.answerFactor(loginIdentity.email, "123456");
    // Observe rejection immediately so this case measures ownership, not an
    // unhandled-promise warning from the test's delayed await.
    void first.catch(() => undefined);
  });
  await waitFor(() => expect(verifies).toBe(1));
  await act(async () => {
    await latest!.answerFactor(loginIdentity.email, "123456");
  });
  expect(latest?.state.phase).toBe("ready");
  expect(latest?.api.bearer()).toEqual({ token: issuedToken.token, id: issuedToken.id });
  await act(async () => {
    refused.resolve(problem("that code is not right"));
    await first.catch(() => undefined);
  });
  expect({
    phase: latest?.state.phase,
    bearer: latest?.api.bearer(),
    saved: JSON.parse(mockSaved.get("platformkit.session")!),
    revocations,
  }).toEqual({
    phase: "ready",
    bearer: { token: issuedToken.token, id: issuedToken.id },
    saved: {
      version: 2,
      baseURL: "https://factor.example.test",
      token: issuedToken.token,
      tokenId: issuedToken.id,
    },
    revocations: [],
  });
});

test("the code field and verify control submit one factor while its answer is pending", async () => {
  reset();
  const pending = Promise.withResolvers<Response>();
  let verifies = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/v1/auth/login") return problem(FACTOR_REQUIRED_DETAIL);
    if (path === "/api/v1/auth/challenge/verify") {
      verifies++;
      return pending.promise;
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  await render(
    <Shell baseURL="https://factor.example.test" renderers={{}}>
      <SignIn />
    </Shell>,
  );
  await waitFor(() => expect(screen.getByTestId("email")).toBeTruthy());
  await fireEvent.changeText(screen.getByTestId("email"), loginIdentity.email);
  await fireEvent.changeText(screen.getByTestId("password"), "password");
  await fireEvent.press(screen.getByTestId("submit"));
  await waitFor(() => expect(screen.getByTestId("challenge")).toBeTruthy());
  await fireEvent.changeText(screen.getByTestId("code"), "123456");
  // Keyboard submit and a tap can be delivered in one frame, before the busy
  // state renders. Both are the actual callbacks the composed screen supplied.
  const submitFromKeyboard = screen.getByTestId("code").props.onSubmitEditing;
  try {
    await act(async () => {
      submitFromKeyboard();
      void fireEvent.press(screen.getByTestId("verify"));
    });
    await waitFor(() => expect(verifies).toBeGreaterThan(0));
    expect(verifies).toBe(1);
  } finally {
    await act(async () => {
      pending.resolve(problem("that code is not right"));
    });
  }
});
