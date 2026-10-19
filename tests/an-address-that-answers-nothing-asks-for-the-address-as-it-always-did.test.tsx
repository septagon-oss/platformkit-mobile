// An address that answers nothing is not a workspace and not a failure: the phone stays on
// the address, wears its own colours and remembers nothing. The person finds out at the
// password, which is what they do today — a 404, a refusal and a body outside the pinned
// schema are one answer here, and none of them is allowed to strand the screen.
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

test("an address that answers nothing keeps the address step and the kit's own look", async () => {
  const wire = asking(() => json({ type: "about:blank", title: "Not Found", status: 404 }, 404));
  globalThis.fetch = wire.fetch;
  const { remembered, shell } = phone();
  const view = await render(shell);
  await connectTo("https://nowhere.test");
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
  // Still the address step, still the kit's colour, nothing remembered: the person is about
  // to find out at the password, which is what they do today, and a failed request does not
  // prove the workspace is not there.
  expect(screen.getByTestId("server")).toBeTruthy();
  expect(screen.getByTestId("accent")).toHaveTextContent(palette.light.accentDefault);
  expect(screen.queryByTestId("email")).toBeNull();
  expect(remembered.rows).toEqual([]);
  expect(wire.calls).toContain("/api/v1/app/connection");
  await settle();
  await view.unmount();
});
