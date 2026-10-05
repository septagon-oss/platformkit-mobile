// Leaving this route, or replacing the session inside it, ends the enrichment in flight. A
// directory response that lands afterwards cannot name a row in the new route's trail, even
// when the event ids are identical.
import React from "react";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { reduce } from "../../src/core/state";
import { createApi } from "../../src/effects/api";
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
  setParams({ module: "note", entity: "note", id: "note-319" });
});

const actor = "actor-319";
const record = "note-319";
const users = { ...note, module: "user", entity: "user", path: "/api/v1/user/users" };
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const trail = {
  items: [
    {
      id: "event-319",
      name: "note.note.updated",
      occurredAt: "2026-07-13T08:41:00Z",
      actor,
      payload: { id: record },
    },
  ],
  total: 1,
};

for (const mode of ["light", "dark"] as const) {
  test.each(["catalog refresh", "session replacement"] as const)(
    `${mode} %s withdraws activity enrichment before equal IDs are read again`,
    async (change) => {
      const obsolete = Promise.withResolvers<Response>();
      const fetch = jest.fn<typeof globalThis.fetch>();
      fetch
        .mockResolvedValueOnce(response(trail))
        .mockResolvedValueOnce(
          response({ items: [{ id: actor, email: "earlier-319@example.test" }], total: 1 }),
        )
        .mockResolvedValueOnce(response(trail))
        .mockReturnValueOnce(obsolete.promise)
        .mockResolvedValueOnce(response(trail));
      const transport = createApi("https://first.example.test", fetch);
      const api = fakeApi();
      api.events.mockImplementation(transport.events);
      api.list.mockImplementation(transport.list);
      const scope = shellValue(api);
      const catalog = { ...scope.state.catalog!, resources: [note, users] };
      const ready = { ...scope, state: { ...scope.state, catalog } };
      shell.value = ready;
      const detail = () => (
        <ThemeProvider mode={mode}>
          <ResourceRoute kind="detail" withID />
        </ThemeProvider>
      );
      const { rerender } = await render(detail());
      await waitFor(() => expect(screen.getByText("earlier-319@example.test")).toBeOnTheScreen());

      shell.value = { ...ready, writes: { "note/note": 1 } };
      await rerender(detail());
      await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
      const boundary = reduce(ready.state, {
        type: change === "catalog refresh" ? "session" : "signed-out",
        generation: 2,
      });
      shell.value = { ...ready, state: boundary };
      await rerender(detail());
      expect(screen.queryByTestId("resource-detail", { includeHiddenElements: true })).toBeNull();
      expect(
        screen.queryByText("earlier-319@example.test", { includeHiddenElements: true }),
      ).toBeNull();
      expect(
        screen.queryByLabelText(/earlier-319@example\.test/, { includeHiddenElements: true }),
      ).toBeNull();

      const next = fakeApi();
      const nextFetch = jest.fn<typeof globalThis.fetch>();
      nextFetch
        .mockResolvedValueOnce(response(trail))
        .mockResolvedValueOnce(
          response({ items: [{ id: actor, displayName: "Current reader 319" }], total: 1 }),
        );
      const nextTransport = createApi("https://second.example.test", nextFetch);
      next.events.mockImplementation(nextTransport.events);
      next.list.mockImplementation(nextTransport.list);
      const loading =
        change === "catalog refresh"
          ? boundary
          : reduce(reduce(boundary, { type: "sign-in", generation: 3 }), {
              type: "session",
              generation: 3,
            });
      const current = change === "catalog refresh" ? api : next;
      const state = reduce(loading, {
        type: "catalog",
        generation: loading.generation,
        catalog: change === "catalog refresh" ? { ...catalog, resources: [note] } : catalog,
      });
      shell.value = shellValue(current, { state });
      await rerender(detail());
      const visibleActor = change === "catalog refresh" ? actor : "Current reader 319";
      await waitFor(() => expect(screen.getByText(visibleActor)).toBeOnTheScreen());

      // The old directory succeeds only after the replacement route has loaded.
      // Reachability uses the response promise, never the stale text we forbid.
      await act(async () => {
        obsolete.resolve(
          response({ items: [{ id: actor, email: "obsolete-319@example.test" }], total: 1 }),
        );
        await api.list.mock.results[1]!.value;
      });
      expect(screen.getByText(visibleActor)).toBeOnTheScreen();
      expect(screen.getByLabelText(new RegExp(visibleActor))).toBeOnTheScreen();
      expect(
        screen.queryByText(/(?:earlier|obsolete)-319@example\.test/, {
          includeHiddenElements: true,
        }),
      ).toBeNull();
      expect(
        screen.queryByLabelText(/(?:earlier|obsolete)-319@example\.test/, {
          includeHiddenElements: true,
        }),
      ).toBeNull();
      expect(api.list).toHaveBeenCalledTimes(2);
      expect(current.events).toHaveBeenLastCalledWith({ record, offset: 0, limit: 20 });
      expect(next.list).toHaveBeenCalledTimes(change === "catalog refresh" ? 0 : 1);
      for (const client of [api, next]) {
        for (const write of [
          client.create,
          client.update,
          client.replace,
          client.remove,
          client.command,
        ])
          expect(write).not.toHaveBeenCalled();
      }
      expect(ready.wrote).not.toHaveBeenCalled();
      expect(shell.value.wrote).not.toHaveBeenCalled();
    },
  );
}
