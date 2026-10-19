// theme.tsx is how a component asks what colour and which face to use, and
// the one place that decides them from the device's appearance. The palette is
// generated from the server's design export (tokens.ts); the faces are the
// export's fallback stacks resolved to what each platform ships; the sizes are
// scale.ts. Nothing else reads a colour.
import React, { createContext, useContext, useMemo } from "react";
import { Platform, StyleSheet, useColorScheme, type ViewStyle } from "react-native";
import { ACCENT } from "../core/workspace";
import { AA, alpha, contrastRatio, meetsAA, mix, type AAKind } from "../core/color";
import type { Status } from "../core/shared";
import { elevation, extent, hit, icon, radius, space, type } from "./scale";
import { palette, type Mode, type Palette } from "./tokens";

export type { Mode, Palette } from "./tokens";

export interface Fonts {
  /** Each role names an available native face; undefined selects the system face. */
  readonly display: string | undefined;
  readonly body: string | undefined;
  readonly mono: string | undefined;
}

export interface Theme {
  readonly mode: Mode;
  readonly color: Palette;
  readonly font: Fonts;
  readonly space: typeof space;
  readonly radius: typeof radius;
  readonly icon: typeof icon;
  readonly extent: typeof extent;
  readonly type: typeof type;
  readonly elevation: typeof elevation;
  readonly state: Interaction;
  readonly surface: Surfaces;
  readonly hit: number;
}

/** Shadow is how a strip says it floats: RN asks for a shadow, Android for an elevation. */
export interface Shadow {
  readonly shadowColor: string;
  readonly shadowOpacity: number;
  readonly shadowRadius: number;
  readonly shadowOffset: { readonly width: number; readonly height: number };
  readonly elevation: number;
}

/**
 * Interaction is the seven states a control can be in, each derived from the
 * palette it sits on. Nothing else may invent a press, a hover or a scrim: a
 * mix over the surface underneath is the one implementation, so AA is a
 * property of the mix rather than a hope (tests/ui/contrast.test.tsx).
 */
export interface Interaction {
  readonly hovered: string;
  readonly pressed: string;
  readonly selected: string;
  readonly disabled: { readonly fill: string; readonly text: string };
  readonly divider: string;
  /** outline is a control's own edge: the line that says something here can be used. */
  readonly outline: string;
  readonly scrim: string;
  readonly raised: Shadow;
}

const raisedShadow = (color: string, strength: number): Shadow => ({
  shadowColor: color,
  shadowOpacity: strength === 2 ? 0.18 : 0.12,
  shadowRadius: strength === 2 ? 20 : 12,
  shadowOffset: { width: 0, height: strength === 2 ? 6 : 4 },
  elevation: strength,
});

const interaction = (c: Palette): Interaction => ({
  hovered: mix(c.surfacePrimary, c.accentDefault, 0.06),
  // A press is the faintest shade that leaves every ink on it legible, counted
  // in the pair registry below: the ripple and the fill of a solid button carry
  // the rest. A darker press would strand a row's secondary line.
  pressed: mix(c.surfacePrimary, c.textPrimary, 0.04),
  // A selection is the accent tinted into the surface it sits on. 0.08 is the most
  // tint that leaves every ink a control paints on it at full strength above AA — a
  // destructive row's title is the binding pair, and the registry below counts it in
  // both palettes. A selection never rests on the tint alone: the accent glyph and
  // the semibold label carry it, so the gap between a hover and a selection is not
  // the only thing a person has.
  selected: mix(c.surfacePrimary, c.accentDefault, 0.08),
  disabled: { fill: mix(c.surfacePrimary, c.surfaceMuted, 0.5), text: c.textMuted },
  divider: c.borderDefault,
  outline: c.textMuted,
  scrim: alpha(c.textPrimary, extent.scrim),
  raised: raisedShadow(c.textPrimary, elevation.raised),
});

// The export's stacks name Iowan Old Style and IBM Plex; iOS ships the first,
// neither ships the second, and a face the phone does not have is the system
// face anyway, so say so.
const fonts: Fonts = {
  display: Platform.select({ ios: "Iowan Old Style", android: "serif", default: "serif" }),
  body: undefined,
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
};

/**
 * Surfaces are the painted pages the palette carries no role for. `band` is Home's
 * greeting wash: the accent mixed into the canvas it sits on, at 0.07 — the most tint
 * that keeps both inks the band draws on it (a greeting in full-strength ink, the
 * workspace line in muted) above AA in both palettes, measured by the pair registry
 * below the way `interaction.selected` states its own factor. Ink over the accent
 * itself is refused: `accentOn` fades into a near-white canvas and strands the
 * greeting halfway down the band. The gradient this wash is the top of ends in
 * `color.surfaceCanvas`, so no seam is painted between the two.
 */
export interface Surfaces {
  readonly band: string;
}

export function themeFor(
  mode: Mode,
  colors: Readonly<Record<Mode, Palette>> = palette,
  faces: Fonts = fonts,
): Theme {
  const color = colors[mode];
  return {
    mode,
    color,
    font: faces,
    space,
    radius,
    icon,
    extent,
    type,
    elevation,
    state: interaction(color),
    surface: { band: mix(color.surfaceCanvas, color.accentDefault, 0.07) },
    hit,
  };
}

/**
 * statusInk is what a tone looks like when it is drawn rather than written: the
 * colour a chart's series, a bar or any other mark wears for its tone. The core
 * decides which tone a value carries; only this function decides the ink, so a
 * series that says "warning" cannot be blue on one screen and amber on another.
 */
export function statusInk(t: Theme, tone: Status["tone"]): string {
  switch (tone) {
    case "info":
      return t.color.statusInfo;
    case "ok":
      return t.color.statusOk;
    case "warning":
      return t.color.statusWarning;
    case "danger":
      return t.color.statusDanger;
    default:
      return t.color.textPrimary;
  }
}

/**
 * contrastPairs is the registry the theme owes AA to: every role it hands a
 * component, on the surface that role is drawn over, with the minimum the
 * acceptance names. A new role with no row here fails the suite, so an
 * interaction state cannot be added faster than it is measured.
 */
export const contrastPairs: readonly [string, string, AAKind][] = [
  ["color.textPrimary", "color.surfaceMuted", "text"],
  ["color.textPrimary", "color.surfacePrimary", "text"],
  ["color.textPrimary", "color.surfaceCanvas", "text"],
  ["color.textPrimary", "color.surfaceMuted", "text"],
  ["color.textMuted", "color.surfacePrimary", "text"],
  ["color.textMuted", "color.surfaceCanvas", "text"],
  ["color.textMuted", "color.statusOkBg", "text"],
  ["color.textMuted", "color.statusDangerBg", "text"],
  ["color.accentDefault", "color.surfacePrimary", "text"],
  ["color.accentDefault", "color.surfaceCanvas", "text"],
  ["color.accentOn", "color.accentDefault", "text"],
  ["color.statusOk", "color.statusOkBg", "text"],
  ["color.statusWarning", "color.statusWarningBg", "text"],
  ["color.statusDanger", "color.statusDangerBg", "text"],
  ["color.statusInfo", "color.statusInfoBg", "text"],
  ["color.sidebarText", "color.sidebarBg", "text"],
  ["color.sidebarMuted", "color.sidebarBg", "text"],
  ["color.textPrimary", "state.hovered", "text"],
  ["color.textPrimary", "state.pressed", "text"],
  ["color.textPrimary", "state.selected", "text"],
  ["color.textMuted", "state.hovered", "text"],
  ["color.textMuted", "state.pressed", "text"],
  ["color.textMuted", "state.selected", "text"],
  // A destructive row keeps its danger ink through every interaction state it can
  // be in, so each of those three is measured with that ink on it, not only the
  // plain surface. Row.tsx paints all three.
  ["color.statusDanger", "state.hovered", "text"],
  ["color.statusDanger", "state.pressed", "text"],
  ["color.statusDanger", "state.selected", "text"],
  // A plain or secondary button's label is accent ink over a hover or a press.
  ["color.accentDefault", "state.pressed", "text"],
  // A destructive button's own label, and a dialog's reason in danger ink.
  ["color.accentOn", "color.statusDanger", "text"],
  ["color.statusDanger", "color.surfacePrimary", "text"],
  // A meter's fill is a graphic that carries how far through the work is, so the
  // three tones it offers are measured against its track.
  ["color.accentDefault", "color.surfaceMuted", "graphic"],
  ["color.statusOk", "color.surfaceMuted", "graphic"],
  ["color.statusWarning", "color.surfaceMuted", "graphic"],
  ["state.disabled.text", "state.disabled.fill", "text"],
  // Home's greeting band is a surface no control sits on and both inks are read on:
  // the greeting at display size, the workspace line at caption size, the binding one.
  ["color.textPrimary", "surface.band", "text"],
  ["color.textMuted", "surface.band", "text"],
  // A selected tab's glyph and a selected row's tick: an icon that carries the
  // selection, not the label, which is drawn in full-strength ink.
  ["color.accentDefault", "state.selected", "graphic"],
  ["color.accentDefault", "state.hovered", "text"],
  ["color.accentOn", "color.accentHover", "text"],
  // A control's edge is drawn in outline, never in the hairline a section rule
  // uses: borderDefault carries no meaning on its own, so nothing claims a
  // ratio for it. borderStrong edges a disabled control, which 1.4.3 exempts.
  ["state.outline", "color.surfacePrimary", "graphic"],
  ["state.outline", "color.surfaceCanvas", "graphic"],
  ["state.outline", "color.surfaceMuted", "graphic"],
  ["color.focus", "color.surfacePrimary", "graphic"],
  ["color.accentDefault", "color.surfacePrimary", "graphic"],
  ["color.statusDanger", "color.surfacePrimary", "graphic"],
  ["color.statusOk", "color.surfacePrimary", "graphic"],
  // A chart series is a mark whose tone is the only thing saying which series a
  // bar or a line is, so every ink statusInk can hand out is measured over both
  // surfaces a plot is drawn on. BarChart.tsx and AreaChart.tsx paint all four.
  ["color.statusInfo", "color.surfacePrimary", "graphic"],
  ["color.statusWarning", "color.surfacePrimary", "graphic"],
  ["color.statusInfo", "color.surfaceCanvas", "graphic"],
  ["color.statusWarning", "color.surfaceCanvas", "graphic"],
  ["color.statusOk", "color.surfaceCanvas", "graphic"],
  ["color.statusDanger", "color.surfaceCanvas", "graphic"],
  // A bar is measured from zero, so the plot draws the zero line; it is a graphic
  // a reader needs to tell a bar above nothing from one below it.
  ["color.textMuted", "color.surfacePrimary", "graphic"],
  ["color.textMuted", "color.surfaceCanvas", "graphic"],
];

/** role reads one registry path ("color.textMuted") out of a built theme. */
const role = (theme: Theme, path: string): string =>
  path
    .split(".")
    .reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], theme) as string;

/** failures measures one built theme against every pair the registry below names. */
const failures = (theme: Theme): readonly string[] =>
  contrastPairs
    .map(([front, back, kind]) => {
      const ratio = contrastRatio(role(theme, front), role(theme, back));
      return meetsAA(ratio, kind)
        ? undefined
        : `${front} on ${back} is ${ratio}, below ${AA[kind]}`;
    })
    .filter((row): row is string => row !== undefined);

/**
 * ACCENT_STEPS is how far a workspace's colour may be pulled toward a mode's own ink:
 * twenty-five hundredths of a shade at a time, up to half. Past half the painted colour
 * no longer claims to be the colour that workspace chose, so the search stops there and
 * the kit's own palette is kept.
 */
const ACCENT_STEPS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5];

/**
 * accentPalette wears one workspace's colour on the kit's generated palette.
 *
 * A workspace answers *one* accent; this palette carries two, because `#0f5d4e` reads on
 * paper and `#4bbf9c` on ink, and no single `#rrggbb` reaches body-text contrast against
 * both canvases — so the colour a phone paints is the nearest shade of the answered one
 * that keeps every pair `contrastPairs` measures, in both modes at once. Mixing toward
 * each mode's own `textPrimary` is the only direction that can only help: it darkens the
 * light palette and lightens the dark one, and it is a generated colour, so no hex is
 * written here. `accentHover` is the worn shade pulled a further 0.15 toward that ink,
 * which is what a hover has always been; `accentOn` stays the generated ink.
 *
 * Inputs: the palettes to wear the colour over (the generated pair by default) and the
 * workspace's accent as `core/workspace`'s `ACCENT` reads it. Failure behaviour is the
 * base object returned **by identity** — an unreadable colour, and a colour that would
 * strand an ink in either mode at any step, keep today's look rather than a half-worn
 * brand. A returned pair is frozen and new, so a caller may memoise on it and
 * `ThemeProvider` settles.
 */
export function accentPalette(
  base: Readonly<Record<Mode, Palette>> = palette,
  accent: string | undefined,
): Readonly<Record<Mode, Palette>> {
  if (accent === undefined || !ACCENT.test(accent)) return base;
  const worn = (mode: Mode): Palette | undefined => {
    const ink = base[mode].textPrimary;
    for (const step of ACCENT_STEPS) {
      const accentDefault = mix(accent, ink, step);
      const colors: Palette = {
        ...base[mode],
        accentDefault,
        accentHover: mix(accentDefault, ink, 0.15),
      };
      if (failures(themeFor(mode, both(base, mode, colors))).length === 0) return colors;
    }
    return undefined;
  };
  const light = worn("light");
  const dark = worn("dark");
  // Both modes or neither: a brand that reads by day and is refused by night would be
  // two workspaces in one app, and the refusal says so by painting the kit's own pair.
  if (light === undefined || dark === undefined) return base;
  return Object.freeze({ light, dark });
}

/** both replaces one mode of a palette pair, leaving the other mode's object standing. */
const both = (base: Readonly<Record<Mode, Palette>>, mode: Mode, colors: Palette) =>
  mode === "light" ? { light: colors, dark: base.dark } : { light: base.light, dark: colors };

const Context = createContext<Theme>(themeFor("light"));

interface ProviderProps {
  readonly children: React.ReactNode;
  /** mode overrides the device's appearance; the gallery uses it to show both. */
  readonly mode?: Mode;
  /** Complete light and dark palettes generated from this application's design export. */
  readonly palette?: Readonly<Record<Mode, Palette>>;
  /** Native faces already available on the device; undefined selects its system face. */
  readonly fonts?: Fonts;
}

export function ThemeProvider({
  children,
  mode,
  palette: colors = palette,
  fonts: faces = fonts,
}: ProviderProps) {
  const scheme = useColorScheme();
  const chosen: Mode = mode ?? (scheme === "dark" ? "dark" : "light");
  const theme = useMemo(() => themeFor(chosen, colors, faces), [chosen, colors, faces]);
  return <Context.Provider value={theme}>{children}</Context.Provider>;
}

export const useTheme = (): Theme => useContext(Context);

/**
 * useStyles memoises a StyleSheet per theme. Pass a function defined at module
 * level, so the sheet is computed once per mode rather than once per render.
 */
export function useStyles<T extends StyleSheet.NamedStyles<T>>(make: (t: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(make(theme)), [theme, make]);
}

/**
 * controlInk puts the label's own colour on the element a press lands on.
 * On the web that element is a box which, left alone, inherits the browser's
 * black: a filled button then measures as black-on-accent (2.7:1) at its own
 * edge even though the word drawn inside it is near-white. Native has no colour
 * to put on a View — the Text that draws the word carries it there — so the
 * style is written only where it means something.
 */
export const controlInk = (color: string): ViewStyle =>
  (Platform.select({ web: { color }, default: undefined }) ?? {}) as ViewStyle;

/** statusPair supplies the semantic foreground and surface used by compact identity media. */
export function statusPair(
  t: Theme,
  tone: Status["tone"],
  neutral: "primary" | "muted" = "primary",
): readonly [string, string] {
  switch (tone) {
    case "info":
      return [t.color.statusInfo, t.color.statusInfoBg];
    case "ok":
      return [t.color.statusOk, t.color.statusOkBg];
    case "warning":
      return [t.color.statusWarning, t.color.statusWarningBg];
    case "danger":
      return [t.color.statusDanger, t.color.statusDangerBg];
    default:
      return [neutral === "muted" ? t.color.textMuted : t.color.textPrimary, t.color.surfaceMuted];
  }
}
