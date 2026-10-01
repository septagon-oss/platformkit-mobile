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
  return <Text testID="custom-detail">{entry.entity}</Text>;
}

beforeEach(() => {
  reset();
  setParams({ module: "note", entity: "note", id: "note-1041" });
});

for (const mode of ["light", "dark"] as const) {
  test(`${mode} a custom detail renderer is unreachable after its catalog entry is withdrawn`, async () => {
    const api = fakeApi();
    const ready = shellValue(api, {
      renderers: { "note/note": { detail: CustomDetail } },
      entry: (module, entity) =>
        shell.value?.state.catalog?.resources.find(
          (resource) => resource.module === module && resource.entity === entity,
        ),
    });
    shell.value = ready;
    const detail = () => (
      <ThemeProvider mode={mode}>
        <ResourceRoute kind="detail" withID />
      </ThemeProvider>
    );
    const { rerender } = await render(detail());
    expect(screen.getByTestId("custom-detail")).toHaveTextContent(note.entity);

    const loading = reduce(ready.state, { type: "session", generation: 2 });
    shell.value = { ...ready, state: loading };
    await rerender(detail());
    expect(screen.queryByTestId("custom-detail", { includeHiddenElements: true })).toBeNull();

    const current = reduce(loading, {
      type: "catalog",
      generation: 2,
      catalog: { ...ready.state.catalog!, resources: [] },
    });
    shell.value = { ...ready, state: current };
    await rerender(detail());

    expect(screen.getByRole("alert")).toBeOnTheScreen();
    expect(screen.queryByTestId("custom-detail", { includeHiddenElements: true })).toBeNull();
    for (const write of [api.create, api.update, api.replace, api.remove, api.command, ready.wrote])
      expect(write).not.toHaveBeenCalled();
  });
}
