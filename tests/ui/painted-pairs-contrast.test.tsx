// The registry in theme.tsx promises AA for "every role it hands a component,
// on the surface that role is drawn over". These are pairs the shared
// components actually paint, read off their source, each measured in both
// palettes with WCAG 2.2 §1.4.3: a pair a component paints is a pair the
// registry answers for, whether or not it lists it.
import { describe, expect, test } from "@jest/globals";
import { AA, contrastRatio, type AAKind } from "../../src/core/color";
import { themeFor, type Theme } from "../../src/ui/theme";

type Role = (t: Theme) => string;

const painted: readonly [string, Role, Role, AAKind][] = [
  // Button tone="destructive" (ConfirmDialog's confirm): label "on" over statusDanger.
  ["destructive button label", (t) => t.color.accentOn, (t) => t.color.statusDanger, "text"],
  // ConfirmDialog's reason: Text role="label" tone="danger" on the card's surfacePrimary.
  ["dialog reason", (t) => t.color.statusDanger, (t) => t.color.surfacePrimary, "text"],
  // Row tone="destructive": its title in danger ink over each interaction state.
  ["destructive row, hovered", (t) => t.color.statusDanger, (t) => t.state.hovered, "text"],
  ["destructive row, pressed", (t) => t.color.statusDanger, (t) => t.state.pressed, "text"],
  ["destructive row, selected", (t) => t.color.statusDanger, (t) => t.state.selected, "text"],
  // Secondary/plain Button label over its hover and press states.
  ["plain button label, hovered", (t) => t.color.accentDefault, (t) => t.state.hovered, "text"],
  ["plain button label, pressed", (t) => t.color.accentDefault, (t) => t.state.pressed, "text"],
  // ProgressMeter's fill over its track (surfaceMuted) in each tone it offers.
  ["meter fill", (t) => t.color.accentDefault, (t) => t.color.surfaceMuted, "graphic"],
  ["meter fill, ok", (t) => t.color.statusOk, (t) => t.color.surfaceMuted, "graphic"],
  ["meter fill, warning", (t) => t.color.statusWarning, (t) => t.color.surfaceMuted, "graphic"],
  // A chart series: BarChart paints each column and AreaChart each line and mark in
  // statusInk's colour for the tone the model carries, over the page's surface.
  ["chart series, neutral", (t) => t.color.textPrimary, (t) => t.color.surfaceCanvas, "graphic"],
  ["chart series, info", (t) => t.color.statusInfo, (t) => t.color.surfaceCanvas, "graphic"],
  ["chart series, ok", (t) => t.color.statusOk, (t) => t.color.surfaceCanvas, "graphic"],
  ["chart series, warning", (t) => t.color.statusWarning, (t) => t.color.surfaceCanvas, "graphic"],
  ["chart series, danger", (t) => t.color.statusDanger, (t) => t.color.surfaceCanvas, "graphic"],
  // The zero line every bar stands on, in the same muted ink as the numbers naming it.
  ["chart zero line", (t) => t.color.textMuted, (t) => t.color.surfaceCanvas, "graphic"],
  // A control drawn chosen (a marked checkbox, a chosen chip or slot): its accent edge
  // over the selection tint it is filled with. Button.tsx paints the pair.
  ["chosen control's edge", (t) => t.color.accentDefault, (t) => t.state.selected, "graphic"],
];

describe("pairs the shared components paint reach AA", () => {
  for (const mode of ["light", "dark"] as const) {
    test(`${mode}: every painted pair reaches its minimum`, () => {
      const t = themeFor(mode);
      const below = painted
        .map(([name, front, back, kind]) => {
          const ratio = contrastRatio(front(t), back(t));
          return ratio >= AA[kind] ? undefined : `${name}: ${ratio} < ${AA[kind]}`;
        })
        .filter((row): row is string => row !== undefined);
      expect(below).toEqual([]);
    });
  }
});
