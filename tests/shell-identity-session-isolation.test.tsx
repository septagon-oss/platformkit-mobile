import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Text } from "react-native";
import { Shell, useShell, type ShellValue } from "../src/shell";

const mockSaved = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockSaved.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockSaved.set(key, value);
  },
}));

const catalog = JSON.parse(readFileSync("testdata/catalog.json", "utf8")) as {
  resources: { module: string; entity: string; path: string }[];
};
const currentPath = "/api/v1/note/current-notes";
const currentCatalog = {
  ...catalog,
  resources: [{ ...catalog.resources[0], path: currentPath }],
};
const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

let shell: ShellValue | undefined;
function SessionState() {
  const value = useShell();
  React.useEffect(() => {
    shell = value;
  });
  return (
    <Text testID="session-state">
      {`${value.state.phase}:${value.entry("note", "note")?.path ?? "none"}`}
    </Text>
  );
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  mockSaved.clear();
  shell = undefined;
});

test("a new ready catalog does not expose a failed session identity", async () => {
  mockSaved.set(
    "platformkit.session",
    JSON.stringify({ version: 1, baseURL: "https://former.test", cookie: "pk=former" }),
  );
  const formerIdentity = Promise.withResolvers<Response>();
  const formerCatalog = Promise.withResolvers<Response>();
  const currentIdentity = Promise.withResolvers<Response>();
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const call = `${url.host} ${init.method ?? "GET"} ${url.pathname}`;
    calls.push(call);
    switch (call) {
      case "former.test GET /api/v1/auth/me":
        return formerIdentity.promise;
      case "former.test GET /api/v1/app/resources":
        return formerCatalog.promise;
      case "current.test POST /api/v1/auth/login":
        return new Response(null, { status: 204, headers: { "Set-Cookie": "pk=current" } });
      case "current.test GET /api/v1/auth/me":
        return currentIdentity.promise;
      case "current.test GET /api/v1/app/resources":
        return json(currentCatalog);
      default:
        return new Response(null, { status: 404 });
    }
  }) as typeof fetch;

  await render(
    <Shell baseURL="https://configured.test" renderers={{}}>
      <SessionState />
    </Shell>,
  );
  await waitFor(() => expect(calls).toContain("former.test GET /api/v1/auth/me"));
  await waitFor(() => expect(calls).toContain("former.test GET /api/v1/app/resources"));
  await act(async () => {
    formerIdentity.resolve(json({ userId: "former", email: "former@example.test" }));
    await formerIdentity.promise;
  });
  await act(async () => {
    formerCatalog.resolve(new Response(null, { status: 503 }));
    await formerCatalog.promise;
  });
  await waitFor(() => expect(screen.getByTestId("session-state")).toHaveTextContent("failed:none"));

  await act(async () => {
    await shell!.signIn("https://current.test", "current@example.test", "password");
  });
  await waitFor(() =>
    expect(screen.getByTestId("session-state")).toHaveTextContent(`ready:${currentPath}`),
  );
  expect(calls).toContain("current.test GET /api/v1/auth/me");
  expect(shell?.api.cookie()).toBe("pk=current");
  try {
    expect(shell?.identity).toBeUndefined();
  } finally {
    await act(async () => {
      currentIdentity.resolve(json({ userId: "current", email: "current@example.test" }));
      await currentIdentity.promise;
    });
  }
});
