// Denied calendar content removes what the person could act on in every view — day, week and
// agenda — and asks for an explicit recovery intent instead of silently refilling the grid.
import React from "react";
import { View } from "react-native";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  deriveCalendar,
  deriveCopy,
  deriveState,
  type CalendarEvent,
  type CalendarInput,
  type Result,
} from "../../src/core/derive";
import { Calendar } from "../../src/ui/organisms/Calendar";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

test.each(
  (["en", "pt"] as const).flatMap((language) =>
    (["light", "dark"] as const).flatMap((mode) =>
      (["day", "week", "agenda"] as const).map((view) => ({ language, mode, view })),
    ),
  ),
)(
  "$language/$mode/$view calendar removes denied content and requires explicit recovery intent",
  async ({ language, mode, view }) => {
    const p = {
      ...presentation,
      copy: deriveCopy(language),
      locale: language === "pt" ? "pt-PT" : "en-GB",
    };
    const title = language === "pt" ? "Consulta privada 41" : "Private appointment 41";
    const reason = language === "pt" ? "Acesso indisponível" : "Access unavailable";
    const event: CalendarEvent = {
      id: "appointment-41",
      title,
      kind: "timed",
      start: "2026-07-18T09:00:00Z",
      end: "2026-07-18T13:00:00Z",
      open: { id: "open", label: title, state: "ready", tone: "plain" },
    };
    const input: CalendarInput = {
      content: { phase: "ready", refresh: "idle", value: [event] },
      view,
      anchorDate: "2026-07-18",
      selectedDate: "2026-07-18",
      selectedEventId: event.id,
      agendaEndDate: "2026-07-19",
      page: { more: false, loading: false },
    };
    const callbacks = {
      onDate: jest.fn(),
      onEvent: jest.fn(),
      onMoreEvents: jest.fn(),
      onRefresh: jest.fn(),
      onMore: jest.fn(),
      onView: jest.fn(),
      onNavigate: jest.fn(),
    };
    const node = (content: CalendarInput["content"]) => (
      <ThemeProvider mode={mode}>
        <View testID="calendar-surface">
          <Calendar
            model={value(deriveCalendar({ ...input, content }, p)).calendar}
            {...callbacks}
          />
        </View>
      </ThemeProvider>
    );
    const eventName = new RegExp(title);
    await render(node(input.content));
    await fireEvent.press(screen.getByRole("button", { name: eventName }));
    expect(callbacks.onEvent.mock.calls).toEqual([[event.id]]);
    callbacks.onEvent.mockClear();

    await screen.rerender(
      node({
        phase: "ready",
        refresh: "idle",
        value: [
          {
            ...event,
            open: { id: "open", label: title, state: "disabled", tone: "plain", reason },
          },
        ],
      }),
    );
    const disabled = screen.getByRole("button", { name: eventName });
    expect(disabled).toBeDisabled();
    await fireEvent.press(disabled);
    await fireEvent(disabled, "accessibilityAction", { nativeEvent: { actionName: "activate" } });
    expect(callbacks.onEvent).not.toHaveBeenCalled();

    for (const code of ["forbidden", "not-found"] as const) {
      const state = value(
        deriveState(
          {
            kind: "error",
            issue: { code, path: "events", recovery: "immutable", message: reason },
          },
          p,
        ),
      );
      await screen.rerender(node({ phase: "error", state }));
      // The container exists independently of either refusal's translated sentence.
      expect(screen.getByTestId("calendar-surface")).toBeOnTheScreen();
      expect(
        screen.queryAllByRole("button", { name: eventName, includeHiddenElements: true }),
      ).toEqual([]);
      expect(screen.queryAllByText(eventName, { includeHiddenElements: true })).toEqual([]);
      for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
    }

    await screen.rerender(node(input.content));
    for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: eventName }));
    expect(callbacks.onEvent.mock.calls).toEqual([[event.id]]);
  },
);
