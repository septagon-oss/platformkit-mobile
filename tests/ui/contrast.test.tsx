// The theme hands a component a role — textMuted, a hover, a disabled fill —
// and never the number underneath. contrastPairs is the registry of which role
// is painted over which, and this suite is what makes it a promise: every row is
// measured with WCAG 2.2 §1.4.3 over both palettes, and a state role cannot be
// painted as a background faster than a row here measures text on it.
import { describe, expect, test } from "@jest/globals";
import { AA, contrastRatio, type AAKind } from "../../src/core/color";
import { contrastPairs, themeFor } from "../../src/ui/theme";
import { palette, type Mode } from "../../src/ui/tokens";

const modes: readonly Mode[] = ["light", "dark"];

const resolve = (theme: object, path: string): string => {
  const value = path
    .split(".")
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown>)[key], theme);
  expect(typeof value).toBe("string");
  return value as string;
};

const fails = (rows: readonly [string, string, AAKind][], theme: object): readonly string[] =>
  rows
    .map(([front, back, kind]) => {
      const ratio = contrastRatio(resolve(theme, front), resolve(theme, back));
      return ratio >= AA[kind]
        ? undefined
        : `${front} on ${back} is ${ratio}, below ${AA[kind]} for ${kind}`;
    })
    .filter((row): row is string => row !== undefined);

describe("the theme's contrast registry", () => {
  for (const mode of modes) {
    test(`${mode}: every pair the registry names reaches its minimum`, () => {
      expect(fails(contrastPairs, themeFor(mode))).toEqual([]);
    });
  }

  test("the registry is measured against both palettes, not one", () => {
    // A row that only fails in one mode is the one worth having: the two runs
    // above are independent, so pin that the palette the registry is written
    // over is the generated one, in both modes.
    expect(Object.keys(palette).sort()).toEqual(["dark", "light"]);
    expect(contrastPairs.length).toBeGreaterThan(20);
  });

  test("every state role a component paints text over is in the registry", () => {
    const painted = [
      "state.hovered",
      "state.pressed",
      "state.selected",
      "state.disabled.fill",
      "state.disabled.text",
      "state.outline",
    ];
    const named = new Set(contrastPairs.flatMap(([front, back]) => [front, back]));
    expect(painted.filter((role) => !named.has(role))).toEqual([]);
    // A tinted background has to be measured with text on it, not beside it.
    const backgrounds = new Set(
      contrastPairs.filter(([, , kind]) => kind === "text").map(([, back]) => back),
    );
    expect(
      ["state.hovered", "state.pressed", "state.selected", "state.disabled.fill"].filter(
        (role) => !backgrounds.has(role),
      ),
    ).toEqual([]);
  });

  test("the registry holds the ratio the standard computes, not one written down", () => {
    // Independently chosen: body text on the two surfaces it is read on, and a
    // hairline border that carries a control's shape.
    const light = themeFor("light");
    expect(
      contrastRatio(light.color.textPrimary, light.color.surfacePrimary),
    ).toBeGreaterThanOrEqual(AA.text);
    expect(contrastRatio(light.color.accentOn, light.color.accentDefault)).toBeGreaterThanOrEqual(
      AA.text,
    );
    expect(contrastRatio(light.state.outline, light.color.surfacePrimary)).toBeGreaterThanOrEqual(
      AA.graphic,
    );
    expect(contrastRatio(light.state.outline, light.color.surfaceMuted)).toBeGreaterThanOrEqual(
      AA.graphic,
    );
  });
});
