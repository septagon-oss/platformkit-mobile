// A remembered workspace is an address with a name on it: listed as a place, pressed
// without a field being touched, and asked about once. It never signs anybody in — the row
// carries a server, a name, a mark and a moment, and no credential has a slot to live in.
import { clock, fakeOutboxStore, fakeReadStore, fakeWorkspaceStore } from "./fakes/store";
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { kitEnglish } from "../src/core/kitCopy";
import { Shell, useShell } from "../src/shell";
import { SignIn } from "../src/screens/SignIn";
import { WorkspaceTheme } from "../src/screens/WorkspaceTheme";
import { useTheme } from "../src/ui/theme";
import { palette } from "../src/ui/tokens";
import { reset } from "./fakes/router";

jest.mock("expo-image", () => ({ Image: "NativeImageDouble" }));
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

test("what this device remembers is listed as places, and a press fills the address with it", async () => {
  const remembered = fakeWorkspaceStore();
  await remembered.store.save({
    host: "https://acme.test",
    name: "Acme Works",
    logoPath: "/api/v1/public/file/files/0199mark",
    seenAt: "2026-10-18T09:00:00.000Z",
  });
  const wire = asking(() => json(body));
  globalThis.fetch = wire.fetch;
  const { shell } = phone({ workspaces: remembered });
  const view = await render(shell);
  expect(view.getByTestId("workspace-remembered-acme-test")).toBeTruthy();
  // The row carries the mark that place answered with, asked of the place itself: this phone
  // is connected to nothing yet, so the only origin the mark could be asked of is its own.
  expect(
    view.getByLabelText(kitEnglish.workspaceMark("Acme Works"), { includeHiddenElements: true })
      .props.source.uri,
  ).toBe("https://acme.test/api/v1/public/file/files/0199mark");
  fireEvent.press(view.getByTestId("workspace-remembered-acme-test"));
  await waitFor(() => expect(screen.getByTestId("workspace-name")).toHaveTextContent("Acme Works"));
  // The person retyped nothing: the address came from the row, and one question was asked.
  expect(wire.calls.filter((path) => path === "/api/v1/app/connection")).toHaveLength(1);
  expect(screen.queryByTestId("server")).toBeNull();
  expect(kitEnglish.rememberedWorkspaces.length).toBeGreaterThan(0);
  await settle();
  await view.unmount();
});
