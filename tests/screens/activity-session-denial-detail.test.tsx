import React from "react";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
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

test.each(["light", "dark"] as const)(
  "%s generated detail withdraws its audit history when the session is refused",
  async (mode) => {
    const actor = "private-audit-actor-73";
    const fetch = jest.fn<typeof globalThis.fetch>();
    fetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "event-73",
                name: "note.note.reviewed",
                occurredAt: "2026-07-18T09:00:00Z",
                actor,
                payload: { id: "note-73" },
              },
            ],
            total: 2,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "The session has expired." }), { status: 401 }),
      );
    // Use the real HTTP decoder: events() intentionally converts 403/404 to
    // empty pages, whereas 401 is a rejected read that reaches this screen.
    const transport = createApi("https://example.test", fetch);
    const api = fakeApi();
    api.events.mockImplementation(transport.events);
    api.get.mockResolvedValue({ id: "note-73", title: "Note 73" });
    shell.value = shellValue(api);
    await render(
      <ThemeProvider mode={mode}>
        <ResourceDetail entry={note} id="note-73" />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByText(actor)).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("activity-more"));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const denied = await fetch.mock.results[1]!.value;
    expect(denied).toHaveProperty("status", 401);
    expect(api.events).toHaveBeenLastCalledWith({ record: "note-73", offset: 1, limit: 20 });
    expect(api.create).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
    expect(api.command).not.toHaveBeenCalled();
    expect(shell.value.wrote).not.toHaveBeenCalled();
    // Reach the refusal via its completed request, not its English error text
    // or the stale row whose absence this assertion requires.
    await waitFor(() =>
      expect({
        actors: screen.queryAllByText(actor, { includeHiddenElements: true }).length,
        events: screen.queryAllByText("Reviewed", { includeHiddenElements: true }).length,
        pagination: screen.queryAllByTestId("activity-more", { includeHiddenElements: true })
          .length,
      }).toEqual({ actors: 0, events: 0, pagination: 0 }),
    );
  },
);
