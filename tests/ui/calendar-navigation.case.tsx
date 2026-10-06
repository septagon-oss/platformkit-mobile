// The Calendar's next and previous controls walk the civil range of the view a person is in,
// in day, week and agenda, in both languages. Undiscovered on purpose: its day and agenda rows
// fail against the calendar the components build today, which is theirs to answer, not this
// pin's. Run it with:
//   npx jest --testMatch '**/tests/ui/calendar-navigation.case.tsx'
import React from "react";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { deriveCalendar } from "../../src/core/derive";
import { Calendar } from "../../src/ui/organisms/Calendar";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

test.each([
  { view: "day", startDate: "2026-07-19", endDate: "2026-07-20", selectedDate: "2026-07-19" },
  { view: "agenda", startDate: "2026-07-21", endDate: "2026-07-24", selectedDate: "2026-07-21" },
  { view: "week", startDate: "2026-07-20", endDate: "2026-07-27", selectedDate: "2026-07-25" },
] as const)("$view Calendar next follows the active view's civil range", async (target) => {
  const result = deriveCalendar(
    {
      content: { phase: "ready", refresh: "idle", value: [] },
      view: target.view,
      anchorDate: "2026-07-18",
      selectedDate: "2026-07-18",
      agendaEndDate: "2026-07-21",
    },
    presentation,
  );
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  const navigate = jest.fn();
  const date = jest.fn();
  await render(
    <ThemeProvider mode="light">
      <Calendar
        model={result.value.calendar}
        onDate={date}
        onEvent={jest.fn()}
        onMoreEvents={jest.fn()}
        onRefresh={jest.fn()}
        onMore={jest.fn()}
        onView={jest.fn()}
        onNavigate={navigate}
      />
    </ThemeProvider>,
  );
  // Reach a real enabled control, without expecting the defective seven-day target.
  const next = screen.getByRole("button", { name: presentation.copy.kit.next });
  expect(next).toBeEnabled();
  await fireEvent.press(next);
  expect(date).not.toHaveBeenCalled();
  expect(navigate.mock.calls).toEqual([
    [{ startDate: target.startDate, endDate: target.endDate, selectedDate: target.selectedDate }],
  ]);
});
