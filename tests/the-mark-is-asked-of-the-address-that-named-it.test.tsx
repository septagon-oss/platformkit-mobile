// A workspace's mark is a path on the host that answered the document naming it, so the
// phone asks that host for it: on a blank phone, and on a phone that was pointed somewhere
// else before the person changed the address. The mark is on the connect step's credentials
// before the password is asked for.
import { clock, fakeOutboxStore, fakeReadStore, fakeWorkspaceStore } from "./fakes/store";
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { kitEnglish } from "../src/core/kitCopy";
import { Shell } from "../src/shell";
import { SignIn } from "../src/screens/SignIn";
import { WorkspaceTheme } from "../src/screens/WorkspaceTheme";
import { reset } from "./fakes/router";

jest.mock("expo-image", () => ({ Image: "NativeImageDouble" }));
jest.mock("expo-router", () => require("./fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("./fakes/router").reactNavigation);

jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));

const body = {
  accent: "#2563eb",
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

const settle = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

/** markURI is the address the image view was handed for the mark named for this workspace. */
const markURI = (): string =>
  screen.getByLabelText(kitEnglish.workspaceMark("Acme Works"), { includeHiddenElements: true })
    .props.source.uri;

function phone(baseURL: string) {
  return (
    <Shell
      baseURL={baseURL}
      renderers={{}}
      store={{
        outbox: fakeOutboxStore().store,
        reads: fakeReadStore().store,
        workspaces: fakeWorkspaceStore().store,
      }}
      clock={clock("2026-10-19T12:00:00.000Z")}
    >
      <WorkspaceTheme>
        <SignIn />
      </WorkspaceTheme>
    </Shell>
  );
}

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

test("a blank phone asks the address it connected to for the mark", async () => {
  globalThis.fetch = (async () => json(body)) as typeof fetch;
  view = await render(phone(""));
  await fireEvent.changeText(screen.getByTestId("server"), "https://acme.test");
  await fireEvent.press(screen.getByTestId("continue"));
  await waitFor(() => expect(screen.getByTestId("workspace-name")).toHaveTextContent("Acme Works"));
  expect(markURI()).toBe("https://acme.test/api/v1/public/file/files/0199mark");
});

test("a changed address asks the new host for the mark, never the one before it", async () => {
  globalThis.fetch = (async () => json(body)) as typeof fetch;
  view = await render(phone("https://other.test"));
  await waitFor(() => expect(screen.getByTestId("change-workspace")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("change-workspace"));
  await fireEvent.changeText(screen.getByTestId("server"), "https://acme.test");
  await fireEvent.press(screen.getByTestId("continue"));
  await waitFor(() => expect(screen.getByTestId("workspace-name")).toHaveTextContent("Acme Works"));
  expect(markURI()).toBe("https://acme.test/api/v1/public/file/files/0199mark");
});
