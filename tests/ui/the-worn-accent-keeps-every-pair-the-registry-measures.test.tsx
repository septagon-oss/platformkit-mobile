// The theme's promise is measured, not asserted: `contrastPairs` names every role the
// theme hands a component and the minimum it reaches on the surface it is drawn over. This
// suite puts a stranger's colour in front of that measurement — the nearest shade of a
// workspace's accent, found by the ladder in `accentPalette` — and refuses to let one pair
// fall. It also pins why the ladder exists: the raw colour a workspace answers does fail
// the registry, in at least one mode, for every accent here.
import { describe, expect, test } from "@jest/globals";
import { AA, contrastRatio, type AAKind } from "../../src/core/color";
import { accentPalette, contrastPairs, themeFor, type Palette } from "../../src/ui/theme";
import { palette, type Mode } from "../../src/ui/tokens";

const modes: readonly Mode[] = ["light", "dark"];

const role = (theme: object, path: string): string =>
  path
    .split(".")
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown>)[key], theme) as string;

const fails = (rows: readonly [string, string, AAKind][], theme: object): readonly string[] =>
  rows
    .map(([front, back, kind]) => {
      const ratio = contrastRatio(role(theme, front), role(theme, back));
      return ratio >= AA[kind]
        ? undefined
        : `${front} on ${back} is ${ratio}, below ${AA[kind]} for ${kind}`;
    })
    .filter((row): row is string => row !== undefined);

/** Accents chosen across the wheel, not beside the kit's own: each is one a workspace may answer. */
const accents = [
  "#2563eb",
  "#b3245c",
  "#7a3cc4",
  "#e0641b",
  "#2f8f2f",
  "#0f7f8c",
  "#8b8b8b",
  "#111111",
];

describe("the worn accent", () => {
  for (const accent of accents) {
    for (const mode of modes) {
      test(`${accent} in ${mode} fails no pair the registry measures`, () => {
        const worn = accentPalette(palette, accent);
        expect(worn).not.toBe(palette);
        expect(fails(contrastPairs, themeFor(mode, worn))).toEqual([]);
      });
    }
  }

  test("exists because the colour as answered is not legible everywhere", () => {
    // One colour cannot serve two canvases: this is the refusal the ladder answers, so a
    // change that made it measure clean would be a change to the registry, not to the rule.
    const refused = accents.filter((accent) => {
      const raw: Record<Mode, Palette> = {
        light: { ...palette.light, accentDefault: accent, accentHover: accent },
        dark: { ...palette.dark, accentDefault: accent, accentHover: accent },
      };
      return modes.some((mode) => fails(contrastPairs, themeFor(mode, raw)).length > 0);
    });
    expect(refused.length).toBeGreaterThan(0);
  });

  test("is never pulled further than half the mode's own ink", () => {
    // #ffd400 is the brightest colour a write rule can answer; worn at any step it would
    // strand the kit's own ink, so the whole palette is refused rather than half-worn.
    expect(accentPalette(palette, "#ffd400")).toBe(palette);
  });
});
