// scale.ts is the one place a distance is written. The design export carries
// colours and type faces, not sizes: a phone's rhythm is its own. Every value
// is in density-independent points; tests/scale.test.ts refuses a length
// written anywhere else in the presentation layers.
import { Platform } from "react-native";

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
/** radius rounds a corner; full is a pill, whatever its height. */
export const radius = { md: 8, lg: 12, full: 999 } as const;
/** icon is a glyph's side: beside a word, on its own, or as an empty state's mark. */
export const icon = { sm: 16, md: 22, lg: 40 } as const;
export type IconSize = keyof typeof icon;
/** extent is the few fixed lengths that are neither a gap nor a corner: how tall a paragraph field opens, how thick a skeleton line is. */
export const extent = { textarea: 120, skeleton: 14 } as const;

/** type is the size and line height of each Text role, and how far Dynamic Type may scale it. */
export const type = {
  caption: { size: 12, line: 16, scale: 1.6 },
  label: { size: 14, line: 18, scale: 1.6 },
  body: { size: 16, line: 22, scale: 2 },
  title: { size: 20, line: 26, scale: 2 },
  display: { size: 26, line: 32, scale: 2 },
  /** mono is an identifier or a raw value: body-sized, in the mono face. */
  mono: { size: 15, line: 20, scale: 1.6 },
} as const;
export type Role = keyof typeof type;

/** hit is the smallest thing a finger is asked to press: Apple's 44pt, Android's 48dp. */
export const hit = Platform.select({ android: 48, default: 44 });
