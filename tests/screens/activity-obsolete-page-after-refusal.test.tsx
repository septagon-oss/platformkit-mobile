// A page requested before a refusal must not repopulate the trail after it. The current refusal
// stands, and only a fresh read from the start restores history and identity.
import React from "react";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
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

const record = "note-347";
const actor = "actor-347";
const users = { ...note, module: "user", entity: "user", path: "/api/v1/user/users" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const trail = (id: string, name: string, total: number) => ({
  items: [{ id, name, actor, occurredAt: "2026-07-21T13:17:00Z", payload: { id: record } }],
  total,
});

for (const mode of ["light", "dark"] as const) {
  test.each([401, 403, 404])(
    `${mode} obsolete pagination cannot restore history after current HTTP %s`,
    async (status) => {
      const obsolete = Promise.withResolvers<Response>();
      const fetch = jest.fn<typeof globalThis.fetch>();
      fetch
        .mockResolvedValueOnce(response(trail("event-347", "note.note.reviewed", 2)))
        .mockReturnValueOnce(obsolete.promise)
        .mockResolvedValueOnce(response({ detail: "Current trail refused" }, status))
        .mockResolvedValueOnce(response(trail("event-349", "note.note.recovered", 1)));
      const transport = createApi("https://example.test", fetch);
      const api = fakeApi();
      api.events.mockImplementation(transport.events);
      api.list.mockResolvedValue({
        items: [{ id: actor, email: "earlier-347@example.test" }],
        total: 1,
      });
      api.get.mockResolvedValue({ id: record, title: "Note 347" });
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
      await waitFor(() => expect(screen.getByText("earlier-347@example.test")).toBeOnTheScreen());
      await fireEvent.press(screen.getByTestId("activity-more"));
      await waitFor(() => expect(api.events).toHaveBeenCalledTimes(2));
      expect(api.events).toHaveBeenLastCalledWith({ record, offset: 1, limit: 20 });

      shell.value = { ...ready, writes: { "note/note": 1 } };
      await rerender(detail());
      await waitFor(() => expect(api.events).toHaveBeenCalledTimes(3));
      await act(async () => {
        // Reach the boundary through the decoded response, not refused copy.
        if (status === 401)
          await expect(api.events.mock.results[2]!.value).rejects.toHaveProperty("status", 401);
        else
          await expect(api.events.mock.results[2]!.value).resolves.toEqual({ items: [], total: 0 });
      });
      expect(await fetch.mock.results[2]!.value).toHaveProperty("status", status);
      const directoryReads = api.list.mock.calls.length;

      await act(async () => {
        obsolete.resolve(response(trail("event-348", "note.note.obsolete", 2)));
        await api.events.mock.results[1]!.value;
      });
      for (const value of ["earlier-347@example.test", actor, "Reviewed", "Obsolete"]) {
        expect(screen.queryByText(value, { includeHiddenElements: true })).toBeNull();
        expect(
          screen.queryByLabelText(new RegExp(value), { includeHiddenElements: true }),
        ).toBeNull();
      }
      expect(screen.queryByTestId("activity-more", { includeHiddenElements: true })).toBeNull();
      expect(api.list).toHaveBeenCalledTimes(directoryReads);

      // Permanent hiding cannot satisfy this pin: a current successful read
      // must restore its own history and newly resolved identity from offset 0.
      api.list.mockResolvedValue({
        items: [{ id: actor, displayName: "Fresh actor 347" }],
        total: 1,
      });
      shell.value = { ...ready, writes: { "note/note": 2 } };
      await rerender(detail());
      await waitFor(() => expect(screen.getByText("Fresh actor 347")).toBeOnTheScreen());
      expect(screen.getByText("Recovered")).toBeOnTheScreen();
      expect(screen.getByLabelText(/Fresh actor 347/)).toBeOnTheScreen();
      expect(screen.queryByText("Obsolete", { includeHiddenElements: true })).toBeNull();
      expect(api.events).toHaveBeenLastCalledWith({ record, offset: 0, limit: 20 });
      expect(api.list).toHaveBeenCalledTimes(directoryReads + 1);
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
