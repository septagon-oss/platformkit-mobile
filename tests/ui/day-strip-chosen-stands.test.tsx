// "A state is visible or it is not a state" cuts both ways: making the chosen day's
// ink legible may not be done by erasing what sets it apart. The strip draws the
// chosen day as the screen's filled verb and the other days outlined, so the fill and
// the ink are one decision — these measure both halves, in the day's own rendered
// style rather than in a colour someone hopes the component picked.
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import { contrastRatio } from "../../src/core/color";
import { deriveCalendar, type DayStripModel } from "../../src/core/derive";
import { DayStrip } from "../../src/ui/molecules/DayStrip";
import { ThemeProvider, themeFor } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const strip: DayStripModel = (() => {
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
  return result.value.strip;
})();

const box = (name: string): Record<string, unknown> =>
  (StyleSheet.flatten(
    (screen.getByRole("button", { name }) as unknown as { props: { style: object } }).props
      .style as object,
  ) ?? {}) as Record<string, unknown>;

for (const mode of ["light", "dark"] as const) {
  test(`${mode}: the chosen day stands by its own fill and reads in its own ink`, async () => {
    const t = themeFor(mode);
    const chosen = strip.days.find((day) => day.selected);
    const other = strip.days.find((day) => !day.selected && day.enabled);
    if (!chosen || !other) throw new Error("The supplied week holds a chosen day and a live one");
    await render(
      <ThemeProvider mode={mode}>
        <DayStrip
          model={strip}
          onDate={() => {}}
          onPrevious={() => {}}
          onNext={() => {}}
          onToday={() => {}}
        />
      </ThemeProvider>,
    );
    const on = box(chosen.title);
    const off = box(other.title);
    // The standing: the chosen day wears the fill and the edge; the day beside it is
    // drawn the plain way, so the two are never the same pixels.
    expect(on.backgroundColor).toBe(t.color.accentDefault);
    expect(off.backgroundColor).toBe(t.color.surfacePrimary);
    // And the ink that fill calls for, measured against the surface under it.
    expect(StyleSheet.flatten(screen.getByText(chosen.label).props.style).color).toBe(
      t.color.accentOn,
    );
    expect(contrastRatio(t.color.accentOn, on.backgroundColor as string)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
}
