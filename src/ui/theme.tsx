// theme.tsx is how a component asks what colour and which face to use, and
// the one place that decides them from the device's appearance. The palette is
// generated from the server's design export (tokens.ts); the faces are the
// export's fallback stacks resolved to what each platform ships; the sizes are
// scale.ts. Nothing else reads a colour.
import React, { createContext, useContext, useMemo } from "react";
import { Platform, StyleSheet, useColorScheme } from "react-native";
import { alpha, mix, type AAKind } from "../core/color";
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
  selected: mix(c.surfacePrimary, c.accentDefault, 0.1),
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

export function themeFor(
  mode: Mode,
  colors: Readonly<Record<Mode, Palette>> = palette,
  faces: Fonts = fonts,
): Theme {
  return {
    mode,
    color: colors[mode],
    font: faces,
    space,
    radius,
    icon,
    extent,
    type,
    elevation,
    state: interaction(colors[mode]),
    hit,
  };
}

/**
 * contrastPairs is the registry the theme owes AA to: every role it hands a
 * component, on the surface that role is drawn over, with the minimum the
 * acceptance names. A new role with no row here fails the suite, so an
 * interaction state cannot be added faster than it is measured.
 */
export const contrastPairs: readonly [string, string, AAKind][] = [
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
  ["state.disabled.text", "state.disabled.fill", "text"],
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
];

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
