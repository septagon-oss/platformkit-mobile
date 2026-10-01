import React from "react";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createApi, type Trail } from "../../src/effects/api";
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

const record = "note-643";
const actor = "actor-643";
const users = { ...note, module: "user", entity: "user", path: "/api/v1/user/users" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const trail = (id: string, name: string, total = 2): Trail => ({
  items: [{ id, name, actor, occurredAt: "2026-07-19T15:38:00Z", payload: { id: record } }],
  total,
});

for (const mode of ["light", "dark"] as const) {
  test.each([401, 403, 404])(
    `${mode} obsolete directory HTTP %s cannot enable paging during a newer read`,
    async (status) => {
      const obsolete = Promise.withResolvers<Response>();
      const refreshed = Promise.withResolvers<Trail>();
      const current = Promise.withResolvers<Response>();
      const older = Promise.withResolvers<Trail>();
      const fetch = jest.fn<typeof globalThis.fetch>();
      fetch
        .mockResolvedValueOnce(
          response({ items: [{ id: actor, email: "earlier-643@example.test" }], total: 1 }),
        )
        .mockReturnValueOnce(obsolete.promise)
        .mockReturnValueOnce(current.promise);
      const api = fakeApi();
      api.list.mockImplementation(createApi("https://example.test", fetch).list);
      api.events
        .mockResolvedValueOnce(trail("event-643", "note.note.created"))
        .mockResolvedValueOnce(trail("event-644", "note.note.updated"))
        .mockReturnValueOnce(refreshed.promise)
        .mockReturnValueOnce(older.promise);
      api.get.mockResolvedValue({ id: record, title: "Activity record" });
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
      await waitFor(() => expect(screen.getByText("earlier-643@example.test")).toBeOnTheScreen());

      shell.value = { ...ready, writes: { "note/note": 1 } };
      await rerender(detail());
      await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
      shell.value = { ...ready, writes: { "note/note": 2 } };
      await rerender(detail());
      await waitFor(() => expect(api.events).toHaveBeenCalledTimes(3));

      // A refused lookup finishes while a newer event read still has no result.
      // The decoded status establishes completion independently of displayed copy.
      await act(async () => {
        obsolete.resolve(response({ detail: "Earlier directory read refused" }, status));
        await expect(api.list.mock.results[1]!.value).rejects.toHaveProperty("status", status);
      });
      const pendingEvents = screen.queryByTestId("activity-more");
      if (pendingEvents) await fireEvent.press(pendingEvents);
      expect(api.events).toHaveBeenCalledTimes(3);

      await act(async () => refreshed.resolve(trail("event-645", "note.note.refreshed")));
      await waitFor(() => expect(api.list).toHaveBeenCalledTimes(3));
      const pendingDirectory = screen.queryByTestId("activity-more");
      if (pendingDirectory) await fireEvent.press(pendingDirectory);
      expect(api.events).toHaveBeenCalledTimes(3);

      await act(async () => {
        current.resolve(
          response({ items: [{ id: actor, displayName: "Current person 643" }], total: 1 }),
        );
        await api.list.mock.results[2]!.value;
      });
      expect(screen.getByText("Current person 643")).toBeOnTheScreen();
      expect(screen.getByLabelText(/Current person 643/)).toBeOnTheScreen();
      expect(screen.getByText("Refreshed")).toBeOnTheScreen();
      expect(
        screen.queryAllByText("earlier-643@example.test", { includeHiddenElements: true }),
      ).toHaveLength(0);
      expect(
        screen.queryAllByLabelText(/earlier-643@example\.test/, { includeHiddenElements: true }),
      ).toHaveLength(0);
      expect(
        screen.queryByText("Earlier directory read refused", { includeHiddenElements: true }),
      ).toBeNull();

      await fireEvent.press(screen.getByTestId("activity-more"));
      const pendingPage = screen.queryByTestId("activity-more");
      if (pendingPage) await fireEvent.press(pendingPage);
      expect(api.events).toHaveBeenCalledTimes(4);
      expect(api.events).toHaveBeenLastCalledWith({ record, offset: 1, limit: 20 });
      await act(async () => older.resolve(trail("event-642", "note.note.older")));
      expect(screen.getByText("Older")).toBeOnTheScreen();
      expect(screen.getAllByText("Current person 643")).toHaveLength(2);
      expect(screen.queryByTestId("activity-more")).toBeNull();
      expect(api.list).toHaveBeenCalledTimes(3);
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
