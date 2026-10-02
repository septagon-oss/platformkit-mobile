import React from "react";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
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
  setParams({ module: "note", entity: "note", id: "note-935" });
});

for (const mode of ["light", "dark"] as const) {
  test(`${mode} a late actor lookup cannot restore identity after catalog withdrawal`, async () => {
    const actor = "actor-935";
    const secret = "No longer authorized person 935";
    const directory = Promise.withResolvers<{
      items: { id: string; displayName: string }[];
      total: number;
    }>();
    const api = fakeApi();
    api.get.mockResolvedValue({ id: "note-935", title: "Activity record" });
    api.events.mockResolvedValue({
      items: [
        {
          id: "event-935",
          name: "note.note.updated",
          actor,
          occurredAt: "2026-08-17T09:12:00Z",
          payload: { id: "note-935" },
        },
      ],
      total: 1,
    });
    api.list.mockReturnValueOnce(directory.promise);
    const scope = shellValue(api);
    const users = { ...note, module: "user", entity: "user", path: "/api/v1/user/users" };
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
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1));

    const loading = reduce(ready.state, { type: "session", generation: 2 });
    shell.value = { ...ready, state: loading };
    await rerender(detail());
    expect(screen.queryByTestId("resource-detail", { includeHiddenElements: true })).toBeNull();

    const current = reduce(loading, {
      type: "catalog",
      generation: 2,
      catalog: { ...ready.state.catalog!, resources: [note] },
    });
    shell.value = { ...ready, state: current };
    await rerender(detail());
    await waitFor(() => expect(api.events).toHaveBeenCalledTimes(2));
    expect(screen.getByText(actor)).toBeOnTheScreen();

    await act(async () => {
      directory.resolve({ items: [{ id: actor, displayName: secret }], total: 1 });
      await api.list.mock.results[0]!.value;
    });
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(screen.getByText(actor)).toBeOnTheScreen();
    expect(screen.getByText("Updated")).toBeOnTheScreen();
    expect(screen.queryAllByText(secret, { includeHiddenElements: true })).toHaveLength(0);
    expect(
      screen.queryAllByLabelText(new RegExp(secret), { includeHiddenElements: true }),
    ).toHaveLength(0);
    for (const write of [api.create, api.update, api.replace, api.remove, api.command, ready.wrote])
      expect(write).not.toHaveBeenCalled();
  });
}
