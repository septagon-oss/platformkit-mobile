import { pageResponse as response } from "../fakes/wire";
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

const record = "note-587";
const actor = "9742e7b5-9ead-5ffa-80da-74ec84f3dca3";
const email = "previous-587@example.test";
const users = { ...note, module: "user", entity: "user", path: "/api/v1/user/users" };

const trail = (id: string, name: string, total = 4): Trail => ({
  items: [{ id, name, actor, occurredAt: "2026-08-11T17:23:00Z", payload: { id: record } }],
  total,
});

for (const mode of ["light", "dark"] as const) {
  test.each([401, 403, 404])(
    `${mode} obsolete event page cannot unlock pagination or defeat directory HTTP %s withdrawal`,
    async (status) => {
      const older = Promise.withResolvers<Trail>();
      const directory = Promise.withResolvers<Response>();
      const recovered = Promise.withResolvers<Response>();
      const fetch = jest.fn<typeof globalThis.fetch>();
      fetch
        .mockResolvedValueOnce(response({ items: [{ id: actor, email }], total: 1 }))
        .mockReturnValueOnce(directory.promise)
        .mockReturnValueOnce(recovered.promise);
      const api = fakeApi();
      api.list.mockImplementation(createApi("https://example.test", fetch).list);
      api.events
        .mockResolvedValueOnce(trail("351fde52-3fad-5a8e-95ca-9c9a2b7fb0dd", "note.note.created"))
        .mockReturnValueOnce(older.promise)
        .mockResolvedValue(trail("04479117-12ac-58e8-bfda-af75c0d05a7f", "note.note.refreshed"));
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
      await waitFor(() => expect(screen.getByText(email)).toBeOnTheScreen());
      await fireEvent.press(screen.getByTestId("activity-more"));
      expect(api.events).toHaveBeenLastCalledWith({ record, offset: 1, limit: 20 });

      shell.value = { ...ready, writes: { "note/note": 1 } };
      await rerender(detail());
      await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
      expect(api.events).toHaveBeenCalledTimes(3);

      // Complete the older event page while the current directory is pending.
      // Its finally block must not enable another page to obsolete that lookup.
      await act(async () => {
        older.resolve(trail("dbaf80e2-bf23-50b0-b67f-8bacee69e57f", "note.note.obsolete"));
        await api.events.mock.results[1]!.value;
      });
      const more = screen.queryByTestId("activity-more");
      if (more) await fireEvent.press(more);
      expect(api.events).toHaveBeenCalledTimes(3);
      expect(screen.queryByText("Obsolete", { includeHiddenElements: true })).toBeNull();

      await act(async () => {
        directory.resolve(response({ detail: "Directory unavailable" }, status));
        await expect(api.list.mock.results[1]!.value).rejects.toHaveProperty("status", status);
      });
      expect(screen.queryAllByText(email, { includeHiddenElements: true })).toHaveLength(0);
      expect(
        screen.queryAllByLabelText(new RegExp(email), { includeHiddenElements: true }),
      ).toHaveLength(0);
      if (status === 401) {
        expect(screen.queryAllByText(actor, { includeHiddenElements: true })).toHaveLength(0);
        expect(screen.queryByText("Refreshed", { includeHiddenElements: true })).toBeNull();
        expect(screen.queryByTestId("activity-more", { includeHiddenElements: true })).toBeNull();
      } else {
        // The trail is still readable without the directory: the person is named as
        // unavailable, and the id they are stored under stays out of the sentence.
        expect(screen.getByText("Name unavailable")).toBeOnTheScreen();
        expect(screen.getByText("Refreshed")).toBeOnTheScreen();
      }

      // A successful event read alone does not restore withdrawn directory fields.
      api.events.mockResolvedValue(
        trail("226897cf-a9e1-5723-b144-bc9153c789f2", "note.note.recovered", 1),
      );
      shell.value = { ...ready, writes: { "note/note": 2 } };
      await rerender(detail());
      await waitFor(() => expect(api.list).toHaveBeenCalledTimes(3));
      expect(api.events).toHaveBeenLastCalledWith({ record, offset: 0, limit: 20 });
      expect(screen.queryAllByText(email, { includeHiddenElements: true })).toHaveLength(0);
      await act(async () => {
        recovered.resolve(
          response({ items: [{ id: actor, displayName: "Current person" }], total: 1 }),
        );
        await api.list.mock.results[2]!.value;
      });
      expect(screen.getByText("Current person")).toBeOnTheScreen();
      expect(screen.getByLabelText(/Current person/)).toBeOnTheScreen();
      expect(screen.getByText("Recovered")).toBeOnTheScreen();
      expect(screen.queryByText("Obsolete", { includeHiddenElements: true })).toBeNull();
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
