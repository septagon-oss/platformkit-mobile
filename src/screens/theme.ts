// theme.ts is the one place a colour or a distance is written. The values are
// design.Light's from the public repository, so a phone and a browser read the
// same product.
export const color = {
  canvas: "#f2efe7",
  surface: "#fffdf7",
  muted: "#e9e4d8",
  text: "#15221f",
  textMuted: "#5f6b65",
  border: "#cbc5b8",
  borderStrong: "#8f988f",
  accent: "#0f5d4e",
  accentOn: "#f9fff9",
  danger: "#9e3833",
  dangerBg: "#fbe5e2",
  ok: "#12715d",
  okBg: "#dcf3e8",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { md: 8, lg: 12 } as const;
export const font = { xs: 12, sm: 14, md: 16, lg: 20, xl: 26 } as const;
