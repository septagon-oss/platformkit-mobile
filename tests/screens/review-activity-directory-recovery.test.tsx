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

const record = "note-217";
const named = "actor-217";
const self = "actor-218";
const emailed = "actor-219";
const priorName = "Previously readable person 217";
const priorEmail = "prior-219@example.test";
const users = { ...note, module: "user", entity: "user", path: "/api/v1/user/users" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const events = [named, self, emailed].map((actor, index) => ({
  id: `event-${217 + index}`,
  name: "note.note.updated",
  occurredAt: `2026-08-12T09:0${index}:00Z`,
  actor,
  payload: { id: record },
}));

function expectWithdrawn() {
  for (const value of [priorName, priorEmail]) {
    expect(screen.queryAllByText(value, { includeHiddenElements: true })).toHaveLength(0);
    expect(
      screen.queryAllByLabelText(new RegExp(value), { includeHiddenElements: true }),
    ).toHaveLength(0);
  }
}

for (const mode of ["light", "dark"] as const) {
  test.each([403, 404])(
    `T0180: ${mode} directory HTTP %s stays withdrawn through paging and partial recovery`,
    async (status) => {
      const recovering = Promise.withResolvers<Response>();
      const fetch = jest.fn<typeof globalThis.fetch>();
      fetch
        .mockResolvedValueOnce(response({ items: events.slice(0, 2), total: 3 }))
        .mockResolvedValueOnce(
          response({
            items: [
              { id: named, displayName: priorName },
              { id: emailed, email: priorEmail },
              { id: self, displayName: "Directory self label" },
            ],
            total: 3,
          }),
        )
        .mockResolvedValueOnce(response({ items: events.slice(0, 2), total: 3 }))
        .mockResolvedValueOnce(response({ detail: "Directory read refused" }, status))
        .mockResolvedValueOnce(response({ items: events.slice(2), total: 3 }))
        .mockResolvedValueOnce(response({ items: events, total: 3 }))
        .mockResolvedValueOnce(response({ detail: "Directory temporarily unavailable" }, 503))
        .mockResolvedValueOnce(response({ items: events, total: 3 }))
        .mockReturnValueOnce(recovering.promise);
      const transport = createApi("https://example.test", fetch);
      const api = fakeApi();
      api.events.mockImplementation(transport.events);
      api.list.mockImplementation(transport.list);
      api.get.mockResolvedValue({ id: record, title: "Review record 217" });
      const scope = shellValue(api, { identity: { userId: self, email: "self@example.test" } });
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
      await waitFor(() => expect(screen.getByText(priorName)).toBeOnTheScreen());
      expect(screen.getByText("You")).toBeOnTheScreen();

      shell.value = { ...ready, writes: { "note/note": 1 } };
      await rerender(detail());
      await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
      await act(async () => {
        await expect(api.list.mock.results[1]!.value).rejects.toHaveProperty("status", status);
      });
      // Request completion/status proves reachability independently of the
      // forbidden data or the particular words used to report the refusal.
      expect(await fetch.mock.results[3]!.value).toHaveProperty("status", status);
      await waitFor(expectWithdrawn);
      expect(screen.getByText(named)).toBeOnTheScreen();
      expect(screen.getByText("You")).toBeOnTheScreen();

      // A previously cached email was not on the first page. Reading its event
      // later must not reintroduce that directory enrichment.
      await fireEvent.press(screen.getByTestId("activity-more"));
      await waitFor(() => expect(screen.getByText(emailed)).toBeOnTheScreen());
      expect(api.events).toHaveBeenLastCalledWith({ record, offset: 2, limit: 20 });
      expect(api.list).toHaveBeenCalledTimes(2);
      expectWithdrawn();

      shell.value = { ...ready, writes: { "note/note": 2 } };
      await rerender(detail());
      await waitFor(() => expect(api.list).toHaveBeenCalledTimes(3));
      await act(async () => {
        await expect(api.list.mock.results[2]!.value).rejects.toHaveProperty("status", 503);
      });
      expectWithdrawn();
      expect(screen.getByText(named)).toBeOnTheScreen();
      expect(screen.getByText(emailed)).toBeOnTheScreen();

      shell.value = { ...ready, writes: { "note/note": 3 } };
      await rerender(detail());
      await waitFor(() => expect(api.list).toHaveBeenCalledTimes(4));
      expectWithdrawn();
      await act(async () => {
        recovering.resolve(
          response({ items: [{ id: named, displayName: "Freshly readable 217" }], total: 1 }),
        );
        await api.list.mock.results[3]!.value;
      });
      await waitFor(() => expect(screen.getByText("Freshly readable 217")).toBeOnTheScreen());
      expect(screen.getByText(emailed)).toBeOnTheScreen();
      expect(screen.getByText("You")).toBeOnTheScreen();
      expectWithdrawn();
      for (const write of [
        api.create,
        api.update,
        api.replace,
        api.remove,
        api.command,
        scope.wrote,
      ])
        expect(write).not.toHaveBeenCalled();
    },
  );
}
