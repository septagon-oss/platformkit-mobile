// The generated validator is the phone's own boundary: a document that names a name and
// nothing else is not a workspace description, and it is refused the way a 404 is — the
// address step stays, the kit's accent stays, and no remembered row is written for a host
// whose answer this phone could not read.
import { clock, fakeOutboxStore, fakeReadStore, fakeWorkspaceStore } from "./fakes/store";
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { Shell, useShell } from "../src/shell";
import { SignIn } from "../src/screens/SignIn";
import { WorkspaceTheme } from "../src/screens/WorkspaceTheme";
import { useTheme } from "../src/ui/theme";
import { palette } from "../src/ui/tokens";
import { reset } from "./fakes/router";

jest.mock("expo-router", () => require("./fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("./fakes/router").reactNavigation);

jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));

/** The answer one workspace gives of itself: name, colour and mark, and nothing about a person. */
const body = {
  accent: "#2563EB",
  accentRatio: { light: 4.5, dark: 3.55 },
  logoUrl: "/api/v1/public/file/files/0199mark",
  methods: { oidc: false, passkey: false, password: true, saml: false },
  name: "Acme Works",
  recovery: { available: false },
  revision: 1,
  signIn: { address: "/api/v1/auth/login" },
  theme: "system",
};

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** asking is the transport with a memory: what it was asked for, in the order it was asked. */
function asking(answer: (path: string) => Response): {
  readonly calls: string[];
  readonly fetch: typeof fetch;
} {
  const calls: string[] = [];
  return {
    calls,
    fetch: (async (input: string | URL | Request) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      return answer(path);
    }) as typeof fetch,
  };
}

function Probe() {
  const value = useShell();
  const theme = useTheme();
  return (
    <>
      <Text testID="phase">{value.state.phase}</Text>
      <Text testID="accent">{theme.color.accentDefault}</Text>
      <Text testID="workspace-read">{value.workspace.name}</Text>
    </>
  );
}

/**
 * A phone with the device's tables, a fixed clock and no saved sign-in: whatever the
 * address step finds is what the theme, the header and the form are given. `workspaces`
 * is the remembered table, which a test may hold its own rows in.
 */
function phone(over: { workspaces?: ReturnType<typeof fakeWorkspaceStore> } = {}) {
  const remembered = over.workspaces ?? fakeWorkspaceStore();
  const shell = (
    <Shell
      baseURL=""
      renderers={{}}
      store={{
        outbox: fakeOutboxStore().store,
        reads: fakeReadStore().store,
        workspaces: remembered.store,
      }}
      clock={clock("2026-10-19T12:00:00.000Z")}
    >
      <WorkspaceTheme>
        <Probe />
      </WorkspaceTheme>
      <SignIn />
    </Shell>
  );
  return { remembered, shell };
}

/**
 * settle lets every promise the phone started reach its answer inside act, so the state
 * it writes lands in this test rather than in the one after it.
 */
const settle = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

/** Ask the phone, from the field, what the workspace at this address is. */
async function connectTo(address: string): Promise<void> {
  fireEvent.changeText(screen.getByTestId("server"), address);
  fireEvent.press(screen.getByTestId("continue"));
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  reset();
});

test("a body outside the pinned schema is answered the same way a refusal is", async () => {
  globalThis.fetch = asking(() => json({ name: "Half a workspace" })).fetch;
  const { remembered, shell } = phone();
  const view = await render(shell);
  await connectTo("https://half.test");
  await waitFor(() => expect(screen.getByTestId("server")).toBeTruthy());
  expect(screen.queryByTestId("email")).toBeNull();
  expect(screen.getByTestId("accent")).toHaveTextContent(palette.light.accentDefault);
  expect(remembered.rows).toEqual([]);
  await settle();
  await view.unmount();
});
