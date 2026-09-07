// theme.tsx is how a component asks what colour and which face to use, and
// the one place that decides them from the device's appearance. The palette is
// generated from the server's design export (tokens.ts); the faces are the
// export's fallback stacks resolved to what each platform ships; the sizes are
// scale.ts. Nothing else reads a colour.
import React, { createContext, useContext, useMemo } from "react";
import { Platform, StyleSheet, useColorScheme } from "react-native";
import { hit, radius, space, type } from "./scale";
import { palette, type Mode, type Palette } from "./tokens";

export interface Fonts {
  /** display is the serif of titles; undefined body and label mean the system face. */
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
  readonly type: typeof type;
  readonly hit: number;
}

// The export's stacks name Iowan Old Style and IBM Plex; iOS ships the first,
// neither ships the second, and a face the phone does not have is the system
// face anyway, so say so.
const fonts: Fonts = {
  display: Platform.select({ ios: "Iowan Old Style", android: "serif", default: "serif" }),
  body: undefined,
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
};

export function themeFor(mode: Mode): Theme {
  return { mode, color: palette[mode], font: fonts, space, radius, type, hit };
}

const Context = createContext<Theme>(themeFor("light"));

interface ProviderProps {
  readonly children: React.ReactNode;
  /** mode overrides the device's appearance; the gallery uses it to show both. */
  readonly mode?: Mode;
}

export function ThemeProvider({ children, mode }: ProviderProps) {
  const scheme = useColorScheme();
  const chosen: Mode = mode ?? (scheme === "dark" ? "dark" : "light");
  const theme = useMemo(() => themeFor(chosen), [chosen]);
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
