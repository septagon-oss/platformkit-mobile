// A lookup the network never answers is one of the ways a workspace says nothing: the
// phone wears its own look, names the place by the host the person typed, and asks for the
// email and the password there. Two things are pinned here that no other case reaches: the
// request went to the address that was typed and to no other, and a wire that dies mid-flight
// strands nobody — no remembered row, no half-worn colour, no screen without a way forward.
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

/**
 * dead is a wire that never replies: every address is asked — so a test can tell the address
 * the person typed from the one this build was configured with — and every answer throws the
 * way a device with no route throws.
 */
function dead(): { readonly calls: string[]; readonly fetch: typeof fetch } {
  const calls: string[] = [];
  return {
    calls,
    fetch: (async (input: string | URL | Request) => {
      calls.push(String(input));
      throw new TypeError("Network request failed");
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

const originalFetch = globalThis.fetch;
let view: Awaited<ReturnType<typeof render>> | undefined;
afterEach(async () => {
  await settle();
  await view?.unmount();
  view = undefined;
  globalThis.fetch = originalFetch;
  reset();
});

test("an address the network never answers is still asked for a password, at its own host", async () => {
  const wire = dead();
  globalThis.fetch = wire.fetch;
  const remembered = fakeWorkspaceStore();
  view = await render(
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
    </Shell>,
  );
  fireEvent.changeText(screen.getByTestId("server"), "https://nowhere.test");
  fireEvent.press(screen.getByTestId("continue"));
  // The way forward is the password, asked of the address that was typed: a phone that could
  // not read a workspace has not proved there is nothing there, and it has no right to close
  // the door for not knowing which failure it met.
  await waitFor(() => expect(screen.getByTestId("email")).toBeTruthy());
  expect(screen.getByTestId("password")).toBeTruthy();
  expect(screen.getByTestId("workspace-name")).toHaveTextContent("nowhere.test");
  // Asked once, and asked of the address in the field rather than the one this build knows.
  expect(wire.calls).toEqual(["https://nowhere.test/api/v1/app/connection"]);
  // Nothing was answered, so nothing is worn: the kit's own colour, no mark, no name the
  // theme or a header could repeat, and no remembered row for a place that never answered.
  expect(screen.getByTestId("accent")).toHaveTextContent(palette.light.accentDefault);
  expect(screen.getByTestId("workspace-read")).toHaveTextContent("");
  expect(screen.queryByTestId("workspace-mark")).toBeNull();
  expect(screen.getByTestId("phase")).toHaveTextContent("anonymous");
  expect(remembered.rows).toEqual([]);
  await settle();
});
