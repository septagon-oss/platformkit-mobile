// An app's key is minted out of the permissions that app declares, not out of the
// kit's own list. A module outside this repository names permissions the pinned
// document has never heard of, and the mint checks a scope against the surface the
// caller actually calls — so the catalogue arrives through <Shell> beside the word
// that app calls its key, the same way tokenName does, and a wildcard holder is
// narrowed to the app's own surface rather than to the kit's.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Text } from "react-native";
import { Shell, useShell, type ShellValue } from "../src/shell";
import { WILDCARD } from "../src/core/scopes";
import { reset } from "./fakes/router";
import { issuedTokenResponse, loginIdentity } from "./fakes/wire";
import { unresolved } from "./fakes/unresolved";

jest.mock("expo-router", () => require("./fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("./fakes/router").reactNavigation);

const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
  },
}));

const catalogDoc: unknown = unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
/** The permission one of this app's own modules names and no route of the kit's asks with. */
const ownPermission = "agenda:publish";

let latest: ShellValue | undefined;
function Probe() {
  const value = useShell();
  React.useEffect(() => {
    latest = value;
  });
  return <Text testID="phase">{value.state.phase}</Text>;
}
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  mockStore.clear();
  latest = undefined;
});

test("an app that declares its own permissions mints a key that carries them", async () => {
  const mints: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const path = new URL(String(input)).pathname;
    const body =
      typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (`${init.method ?? "GET"} ${path}` === "POST /api/v1/auth/login")
      // The built-in administrator holds the wildcard and nothing else.
      return json({ ...loginIdentity, permissions: [WILDCARD] }, 200);
    if (`${init.method ?? "GET"} ${path}` === "POST /api/v1/auth/tokens") {
      const scopes = (body.scopes ?? []) as string[];
      mints.push({ ...body, scopes });
      return issuedTokenResponse({}, { scopes });
    }
    if (`${init.method ?? "GET"} ${path}` === "GET /api/v1/app/resources") return json(catalogDoc);
    if (`${init.method ?? "GET"} ${path}` === "GET /api/v1/auth/me") return json(loginIdentity);
    return json({ status: 404, detail: `no route for ${init.method ?? "GET"} ${path}` }, 404);
  }) as typeof fetch;
  reset();
  await render(
    <Shell
      baseURL="https://agenda.test"
      renderers={{}}
      tokenName="This agenda"
      declaredGrants={[{ permission: ownPermission, operator: false, surface: "app" }]}
    >
      <Probe />
    </Shell>,
  );
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
  await act(async () => {
    await latest!.signIn("https://agenda.test", loginIdentity.email, "password");
  });
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("ready"));
  expect(mints).toHaveLength(1);
  const scopes = mints[0]!.scopes as string[];
  expect(scopes).toContain(ownPermission);
  expect(scopes).not.toContain(WILDCARD);
  expect(mints[0]!.name).toBe("This agenda");
});
