// An old request's refusal says nothing about the current one. When it fails after a newer read
// has succeeded, the trail keeps its rows and the identities that newer read resolved.
import React from "react";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { createApi } from "../../src/effects/api";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
import { ThemeProvider } from "../../src/ui/theme";
import { reset } from "../fakes/router";
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

beforeEach(reset);

const actor = "actor-263";
const record = "note-263";
const users = { ...note, module: "user", entity: "user", path: "/api/v1/user/users" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const trail = (id: string) => ({
  items: [
    {
      id,
      name: "note.note.updated",
      occurredAt: "2026-08-16T14:03:00Z",
      actor,
      payload: { id: record },
    },
  ],
  total: 1,
});

for (const mode of ["light", "dark"] as const) {
  test.each([401, 403, 404])(
    `${mode} obsolete directory HTTP %s cannot withdraw a newer authorized trail`,
    async (status) => {
      const obsolete = Promise.withResolvers<Response>();
      const fetch = jest.fn<typeof globalThis.fetch>();
      fetch
        .mockResolvedValueOnce(response(trail("event-263")))
        .mockResolvedValueOnce(
          response({ items: [{ id: actor, displayName: "Initial actor 263" }], total: 1 }),
        )
        .mockResolvedValueOnce(response(trail("event-264")))
        .mockReturnValueOnce(obsolete.promise)
        .mockResolvedValueOnce(response(trail("event-265")))
        .mockResolvedValueOnce(
          response({ items: [{ id: actor, displayName: "Current actor 263" }], total: 1 }),
        );
      const transport = createApi("https://example.test", fetch);
      const api = fakeApi();
      api.events.mockImplementation(transport.events);
      api.list.mockImplementation(transport.list);
      api.get.mockResolvedValue({ id: record, title: "Note 263" });
      const scope = shellValue(api);
      const ready = {
        ...scope,
        state: { ...scope.state, catalog: { ...scope.state.catalog!, resources: [note, users] } },
      };
      shell.value = ready;
      const detail = () => (
        <ThemeProvider mode={mode}>
          <ResourceDetail entry={note} id={record} />
        </ThemeProvider>
      );
      const { rerender } = await render(detail());
      await waitFor(() => expect(screen.getByText("Initial actor 263")).toBeOnTheScreen());

      shell.value = { ...ready, writes: { "note/note": 1 } };
      await rerender(detail());
      await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
      shell.value = { ...ready, writes: { "note/note": 2 } };
      await rerender(detail());
      await waitFor(() => expect(screen.getByText("Current actor 263")).toBeOnTheScreen());

      // The old directory request reaches its decoded refusal after the current
      // read succeeds. Its status, not a refusal sentence, establishes ordering.
      await act(async () => {
        obsolete.resolve(response({ detail: "Obsolete directory refusal" }, status));
        await expect(api.list.mock.results[1]!.value).rejects.toHaveProperty("status", status);
      });
      expect(api.events).toHaveBeenCalledTimes(3);
      expect(api.list).toHaveBeenCalledTimes(3);
      expect(api.events).toHaveBeenLastCalledWith({ record, offset: 0, limit: 20 });
      expect(screen.getByText("Current actor 263")).toBeOnTheScreen();
      expect(screen.getByLabelText(/Current actor 263/)).toBeOnTheScreen();
      expect(screen.queryByText("Initial actor 263", { includeHiddenElements: true })).toBeNull();
      expect(
        screen.queryByText("Obsolete directory refusal", { includeHiddenElements: true }),
      ).toBeNull();
      for (const write of [
        api.create,
        api.update,
        api.replace,
        api.remove,
        api.command,
        ready.wrote,
      ])
        expect(write).not.toHaveBeenCalled();
    },
  );
}
