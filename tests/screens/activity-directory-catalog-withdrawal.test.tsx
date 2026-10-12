import React from "react";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react-native";
import { reduce } from "../../src/core/state";
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

beforeEach(() => {
  reset();
  setParams({ module: "note", entity: "note", id: "note-812" });
});

const record = "note-812";
const actor = "actor-812";
const previousName = "Previously authorized person 812";
const users = { ...note, module: "user", entity: "user", path: "/api/v1/user/users" };
const trail = {
  items: [
    {
      id: "event-812",
      name: "note.note.updated",
      actor,
      occurredAt: "2026-08-17T09:12:00Z",
      payload: { id: record },
    },
  ],
  total: 1,
};

for (const mode of ["light", "dark"] as const) {
  test(`${mode} catalog withdrawal removes cached actor details while retaining readable history`, async () => {
    const api = fakeApi();
    api.get.mockResolvedValue({ id: record, title: "Activity record" });
    api.events.mockResolvedValue(trail);
    api.list.mockResolvedValue({ items: [{ id: actor, displayName: previousName }], total: 1 });
    const scope = shellValue(api);
    const ready = {
      ...scope,
      state: {
        ...scope.state,
        catalog: { ...scope.state.catalog!, resources: [note, users] },
      },
    };
    shell.value = ready;
    const detail = () => (
      <ThemeProvider mode={mode}>
        <ResourceRoute kind="detail" withID />
      </ThemeProvider>
    );
    const { rerender } = await render(detail());
    await waitFor(() => expect(screen.getByText(previousName)).toBeOnTheScreen());

    const loading = reduce(ready.state, { type: "session", generation: 2 });
    shell.value = { ...ready, state: loading };
    await rerender(detail());
    expect(screen.queryByTestId("resource-detail", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryAllByText(previousName, { includeHiddenElements: true })).toHaveLength(0);

    const current = reduce(loading, {
      type: "catalog",
      generation: 2,
      catalog: { ...ready.state.catalog!, resources: [note] },
    });
    shell.value = { ...ready, state: current };
    await rerender(detail());
    await waitFor(() => expect(api.events).toHaveBeenCalledTimes(2));
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Name unavailable")).toBeOnTheScreen();
    expect(screen.getByText("Updated")).toBeOnTheScreen();
    expect(screen.queryAllByText(previousName, { includeHiddenElements: true })).toHaveLength(0);
    expect(
      screen.queryAllByLabelText(new RegExp(previousName), { includeHiddenElements: true }),
    ).toHaveLength(0);
    for (const write of [api.create, api.update, api.replace, api.remove, api.command, ready.wrote])
      expect(write).not.toHaveBeenCalled();
  });
}
