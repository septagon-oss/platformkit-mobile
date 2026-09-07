// theme.ts is the light palette under the names the screens still use, read
// from the generated tokens. It exists for one step: the screens move to
// useTheme() as they become organisms, and this file goes with the last one.
import { palette } from "../ui/tokens";

const light = palette.light;

export const color = {
  canvas: light.surfaceCanvas,
  surface: light.surfacePrimary,
  muted: light.surfaceMuted,
  text: light.textPrimary,
  textMuted: light.textMuted,
  border: light.borderDefault,
  borderStrong: light.borderStrong,
  accent: light.accentDefault,
  accentOn: light.accentOn,
  danger: light.statusDanger,
  dangerBg: light.statusDangerBg,
  ok: light.statusOk,
  okBg: light.statusOkBg,
} as const;

export { radius, space } from "../ui/scale";
export const font = { xs: 12, sm: 14, md: 16, lg: 20, xl: 26 } as const;
