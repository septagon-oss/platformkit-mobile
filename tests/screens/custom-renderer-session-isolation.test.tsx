import React from "react";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { reduce } from "../../src/core/state";
import type { ScreenProps } from "../../src/renderers";
import { ResourceRoute } from "../../src/route";
import { ThemeProvider } from "../../src/ui/theme";
import { reset, setParams } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock(
  "expo-router",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").expoRouter,
);
jest.mock(
  "expo-router/react-navigation",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").reactNavigation,
);
jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));

function CustomDetail({ entry }: ScreenProps) {
  return <Text testID="custom-detail">{entry.path}</Text>;
}

beforeEach(() => {
  reset();
  setParams({ module: "note", entity: "note", id: "same-record-id" });
});

for (const mode of ["light", "dark"] as const) {
  test(`${mode} a custom renderer follows only the current session catalog`, async () => {
    const api = fakeApi();
    const first = shellValue(api, {
      renderers: { "note/note": { detail: CustomDetail } },
      entry: (module, entity) =>
        shell.value?.state.catalog?.resources.find(
          (resource) => resource.module === module && resource.entity === entity,
        ),
    });
    shell.value = first;
    const detail = () => (
      <ThemeProvider mode={mode}>
        <ResourceRoute kind="detail" withID />
      </ThemeProvider>
    );
    const { rerender } = await render(detail());
    expect(screen.getByTestId("custom-detail")).toHaveTextContent(note.path);

    const signedOut = reduce(first.state, { type: "signed-out", generation: 2 });
    const obsolete = reduce(signedOut, {
      type: "catalog",
      generation: 1,
      catalog: first.state.catalog!,
    });
    expect(obsolete).toBe(signedOut);
    shell.value = { ...first, state: obsolete };
    await rerender(detail());
    expect(screen.getByTestId("redirect")).toHaveTextContent("/sign-in");
    expect(screen.queryByTestId("custom-detail", { includeHiddenElements: true })).toBeNull();

    const signingIn = reduce(obsolete, { type: "sign-in", generation: 3 });
    const loading = reduce(signingIn, { type: "session", generation: 3 });
    shell.value = { ...first, state: loading };
    await rerender(detail());
    expect(screen.queryByTestId("custom-detail", { includeHiddenElements: true })).toBeNull();

    const withoutGrant = reduce(loading, {
      type: "catalog",
      generation: 3,
      catalog: { ...first.state.catalog!, resources: [] },
    });
    shell.value = { ...first, state: withoutGrant };
    await rerender(detail());
    expect(screen.getByRole("alert")).toBeOnTheScreen();
    expect(screen.queryByTestId("custom-detail", { includeHiddenElements: true })).toBeNull();

    const nextEntry = { ...note, path: "/api/v1/note/current-notes" };
    const newLoading = reduce(withoutGrant, { type: "session", generation: 4 });
    const current = reduce(newLoading, {
      type: "catalog",
      generation: 4,
      catalog: { ...first.state.catalog!, resources: [nextEntry] },
    });
    shell.value = { ...first, state: current };
    await rerender(detail());
    expect(screen.getByTestId("custom-detail")).toHaveTextContent(nextEntry.path);
    expect(screen.queryByText(note.path, { includeHiddenElements: true })).toBeNull();
    for (const write of [api.create, api.update, api.replace, api.remove, api.command, first.wrote])
      expect(write).not.toHaveBeenCalled();
  });
}
