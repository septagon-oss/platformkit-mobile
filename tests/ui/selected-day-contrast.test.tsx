import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import { contrastRatio } from "../../src/core/color";
import { deriveCalendar } from "../../src/core/derive";
import { DayStrip } from "../../src/ui/molecules/DayStrip";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

for (const mode of ["light", "dark"] as const) {
  test(`${mode}: the selected calendar day retains readable text`, async () => {
    const result = deriveCalendar(
      {
        content: { phase: "ready", value: [], refresh: "idle" },
        view: "week",
        anchorDate: "2026-10-05",
        selectedDate: "2026-10-07",
        agendaEndDate: "2026-10-12",
      },
      presentation,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    const model = result.value.strip;
    const day = model.days.find((entry) => entry.selected);
    if (!day) throw new Error("The supplied date must occur in the displayed week");
    await render(
      <ThemeProvider mode={mode}>
        <DayStrip
          model={model}
          onDate={() => {}}
          onPrevious={() => {}}
          onNext={() => {}}
          onToday={() => {}}
        />
      </ThemeProvider>,
    );
    const control = screen.getByRole("button", { name: day.title });
    const background = StyleSheet.flatten(control.props.style).backgroundColor;
    const foreground = StyleSheet.flatten(screen.getByText(day.label).props.style).color;
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
}
