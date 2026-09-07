// scale.ts is the one place a distance is written. The design export carries
// colours and type faces, not sizes: a phone's rhythm is its own. Every value
// is in density-independent points.
import { Platform } from "react-native";

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { md: 8, lg: 12 } as const;

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
