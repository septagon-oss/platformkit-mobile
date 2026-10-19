// The connect step, end to end: the person types an address, the phone asks that address
// what it is, and the answer — name, host, colour, mark — is on screen before a
// password is asked for, painted in the colour the workspace brought. Everything below
// runs over the real transport (the pinned `zConnection` and the route table are in the
// path) and the real shell; only the network and the device's tables are answered from
// memory.
import { clock, fakeOutboxStore, fakeReadStore, fakeWorkspaceStore } from "./fakes/store";
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { kitEnglish } from "../src/core/kitCopy";
import { Shell, useShell, type ShellValue } from "../src/shell";
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
      {/* The app wears the workspace's colour over the whole tree, sign-in form included, so a
          case that stops at the form can still read the colour it was drawn in. */}
      <WorkspaceTheme>
        <Probe />
        <SignIn />
      </WorkspaceTheme>
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
test("the address step asks for a place before anything asks who you are", async () => {
  globalThis.fetch = asking(() => json(body)).fetch;
  const { shell } = phone();
  const view = await render(shell);
  expect(view.getByTestId("sign-in")).toBeTruthy();
  expect(view.getByTestId("server")).toBeTruthy();
  expect(view.getByTestId("continue")).toBeTruthy();
  // No password is on this screen, and no accent has been worn yet — not in the theme and
  // not in the fill of the one verb this screen offers.
  expect(view.queryByTestId("email")).toBeNull();
  expect(view.getByTestId("accent")).toHaveTextContent(palette.light.accentDefault);
  expect(StyleSheet.flatten(view.getByTestId("continue").props.style).backgroundColor).toBe(
    palette.light.accentDefault,
  );
  await settle();
  await view.unmount();
});

test("Continue asks once, and the workspace it answered for is on screen before the password", async () => {
  const wire = asking(() => json(body));
  globalThis.fetch = wire.fetch;
  const { remembered, shell } = phone();
  const view = await render(shell);
  await connectTo("https://acme.test");
  await waitFor(() => expect(screen.getByTestId("workspace-name")).toHaveTextContent("Acme Works"));
  expect(wire.calls.filter((path) => path === "/api/v1/app/connection")).toHaveLength(1);
  expect(screen.getByTestId("workspace-host")).toHaveTextContent("acme.test");
  expect(screen.getByTestId("workspace-read")).toHaveTextContent("Acme Works");
  // The kit's accent is gone from the tree and the workspace's nearest legible shade is
  // painted with it; the password step is where the person now stands.
  expect(screen.getByTestId("accent")).toHaveTextContent("#2461e6");
  // and the form the person is standing on was drawn with it, not only the theme below it.
  expect(StyleSheet.flatten(screen.getByTestId("submit").props.style).backgroundColor).toBe(
    "#2461e6",
  );
  expect(screen.getByTestId("email")).toBeTruthy();
  expect(screen.getByTestId("change-workspace")).toBeTruthy();
  expect(screen.queryByTestId("server")).toBeNull();
  // And this device remembers the place by name — never a credential.
  expect(remembered.rows).toEqual([
    {
      host: "https://acme.test",
      name: "Acme Works",
      logoPath: "/api/v1/public/file/files/0199mark",
      seenAt: "2026-10-19T12:00:00.000Z",
    },
  ]);
  expect(JSON.stringify(remembered.rows)).not.toMatch(/token|password|cookie/i);
  await settle();
  await view.unmount();
});
