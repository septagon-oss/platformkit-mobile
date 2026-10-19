// A workspace that answers no connection document is still a place a person can sign in
// at: the phone wears its own look, names the place by its host, and asks for the email
// and the password there. A server that predates the document, or one whose document is
// briefly unavailable, must not leave a fresh install with no way past the address.
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

function Probe() {
  const value = useShell();
  const theme = useTheme();
  return (
    <>
      <Text testID="phase">{value.state.phase}</Text>
      <Text testID="accent">{theme.color.accentDefault}</Text>
    </>
  );
}

const settle = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

// The view is unmounted after every case, a failing one too, so no shell outlives its case.
let view: Awaited<ReturnType<typeof render>> | undefined;
const originalFetch = globalThis.fetch;
afterEach(async () => {
  await settle();
  await view?.unmount();
  view = undefined;
  globalThis.fetch = originalFetch;
  reset();
});

test.each([
  ["absent", 404, "Not Found"],
  ["failing", 503, "Service Unavailable"],
])(
  "a %s connection document still reaches the password with the host as the name",
  async (_kind, status, title) => {
    globalThis.fetch = (async () =>
      json({ type: "about:blank", title, status }, status)) as typeof fetch;
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
        <WorkspaceTheme>
          <Probe />
        </WorkspaceTheme>
        <SignIn />
      </Shell>,
    );
    await fireEvent.changeText(screen.getByTestId("server"), "https://nowhere.test");
    await fireEvent.press(screen.getByTestId("continue"));
    // The password is asked at the address the person typed, which is today's journey.
    await waitFor(() => expect(screen.getByTestId("email")).toBeTruthy());
    expect(screen.getByTestId("password")).toBeTruthy();
    expect(screen.getByTestId("workspace-name")).toHaveTextContent("nowhere.test");
    // Today's look, and nothing remembered about a place that said nothing of itself.
    expect(screen.getByTestId("accent")).toHaveTextContent(palette.light.accentDefault);
    expect(remembered.rows).toEqual([]);
  },
);
