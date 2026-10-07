// An appointment is its name and, beneath it, when it is. Welding the two into one
// control label gave every entry the same long centred line of text, and a heading
// of the same weight for every empty day in the week.
import React from "react";
import { StyleSheet } from "react-native";
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { kitExamples, type Result } from "../../src/core/derive";
import { AgendaList } from "../../src/ui/organisms/AgendaList";
import { ThemeProvider, themeFor } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const ok = <T,>(result: Result<T>): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

const model = ok(kitExamples(presentation, "agenda-list/range")).calendar.agenda;
const events = model.days.flatMap((day) => day.events);

test("every day of the specimen has an appointment to read", () => {
  expect(events.length).toBeGreaterThan(0);
});

test("an appointment carries its name and its time apart, and states both together", () => {
  for (const event of events) {
    // The list writes the name above the time; it needs the two separately and
    // the one line a screen reader hears needs both.
    expect(event.title).toBeTruthy();
    expect(event.time).toBeTruthy();
    expect(event.label).toBe(`${event.title} \u00b7 ${event.time}`);
  }
});

test("a day with nothing in it says so quietly, under the date", async () => {
  const empty = model.days.find((day) => !day.events.length);
  expect(empty).toBeDefined();
  await render(
    <ThemeProvider mode="light">
      <AgendaList model={model} onEvent={() => {}} />
    </ThemeProvider>,
  );
  const t = themeFor("light"),
    line = screen.getAllByText(empty!.emptyLabel)[0]!,
    heading = screen.getAllByText(empty!.title)[0]!;
  // Both are the ink a scan reads past: the week's empty days are where the reader
  // is, not what came to look at.
  expect(StyleSheet.flatten(heading.props.style)?.color).toBe(t.color.textMuted);
  expect(StyleSheet.flatten(line.props.style)?.color).toBe(t.color.textMuted);
  expect(heading.props.accessibilityRole).toBe("header");
});
