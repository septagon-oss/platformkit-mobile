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

const record = "note-421";
const actor = "actor-421";
const previousEmail = "prior-421@example.test";
const users = { ...note, module: "user", entity: "user", path: "/api/v1/user/users" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const trail = (id: string, name: string, total = 3) => ({
  items: [{ id, name, actor, occurredAt: "2026-07-23T11:43:00Z", payload: { id: record } }],
  total,
});

for (const mode of ["light", "dark"] as const) {
  test.each([
    { status: 403, tryPaging: false },
    { status: 404, tryPaging: false },
    { status: 403, tryPaging: true },
    { status: 404, tryPaging: true },
  ])(
    `T0180: ${mode} directory HTTP $status withdraws names, concurrent paging: $tryPaging`,
    async ({ status, tryPaging }) => {
      const directory = Promise.withResolvers<Response>();
      const fetch = jest.fn<typeof globalThis.fetch>();
      fetch
        .mockResolvedValueOnce(response({ items: [{ id: actor, email: previousEmail }], total: 1 }))
        // Any additional directory read also refuses until explicit recovery.
        .mockReturnValue(directory.promise);
      const api = fakeApi();
      api.list.mockImplementation(createApi("https://example.test", fetch).list);
      api.events
        .mockResolvedValueOnce(trail("event-421", "note.note.reviewed"))
        .mockResolvedValueOnce(trail("event-422", "note.note.refreshed"))
        .mockResolvedValue(trail("event-423", "note.note.appended"));
      api.get.mockResolvedValue({ id: record, title: "Review record 421" });
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
      await waitFor(() => expect(screen.getByText(previousEmail)).toBeOnTheScreen());

      shell.value = { ...ready, writes: { "note/note": 1 } };
      await rerender(detail());
      await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));

      // Try the available UI while the latest directory read is pending. A
      // cure may serialize these reads by hiding/disabling Older events; the
      // reachability probe must not require that vulnerable control to stay.
      if (tryPaging) {
        const more = screen.queryByTestId("activity-more");
        if (more) await fireEvent.press(more);
      }
      await act(async () => {
        directory.resolve(response({ detail: "Directory access withdrawn" }, status));
        await expect(api.list.mock.results[1]!.value).rejects.toHaveProperty("status", status);
      });
      expect(await fetch.mock.results[1]!.value).toHaveProperty("status", status);
      for (const write of [
        api.create,
        api.update,
        api.replace,
        api.remove,
        api.command,
        ready.wrote,
      ])
        expect(write).not.toHaveBeenCalled();

      // A successful event page authorizes its events, not cached directory
      // fields. No newer directory success exists to supersede this refusal.
      expect({
        text: screen.queryAllByText(previousEmail, { includeHiddenElements: true }).length,
        accessible: screen.queryAllByLabelText(new RegExp(previousEmail), {
          includeHiddenElements: true,
        }).length,
      }).toEqual({ text: 0, accessible: 0 });
      expect(screen.getAllByText(actor).length).toBeGreaterThan(0);
      expect(screen.getByText("Refreshed")).toBeOnTheScreen();

      // Permanently hiding enrichment cannot satisfy the expected behavior.
      api.events.mockResolvedValue(trail("event-424", "note.note.recovered", 1));
      fetch.mockResolvedValue(
        response({ items: [{ id: actor, displayName: "Fresh person 421" }], total: 1 }),
      );
      shell.value = { ...ready, writes: { "note/note": 2 } };
      await rerender(detail());
      await waitFor(() => expect(screen.getByText("Fresh person 421")).toBeOnTheScreen());
      expect(screen.getByLabelText(/Fresh person 421/)).toBeOnTheScreen();
      expect(screen.queryAllByText(previousEmail, { includeHiddenElements: true })).toHaveLength(0);
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
