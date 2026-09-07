// Icon is the closed vocabulary of glyphs a screen may use, by what they mean
// rather than what the icon set calls them, the way the web shell's icon
// provider resolves a name. A glyph nobody asks for is a glyph nothing draws.
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { useTheme } from "../theme";
import { toneColor, type Tone } from "./Text";

const glyphs = {
  add: "add",
  back: "chevron-back",
  calendar: "calendar-outline",
  clock: "time-outline",
  close: "close",
  check: "checkmark",
  chevron: "chevron-forward",
  edit: "create-outline",
  empty: "folder-open-outline",
  more: "ellipsis-horizontal",
  offline: "cloud-offline-outline",
  person: "person-circle-outline",
  refresh: "refresh",
  server: "server-outline",
  signOut: "log-out-outline",
  sort: "swap-vertical-outline",
  trash: "trash-outline",
  warning: "alert-circle-outline",
} as const;

export type IconName = keyof typeof glyphs;
export type IconSize = "sm" | "md" | "lg";

const sizes: Record<IconSize, number> = { sm: 16, md: 22, lg: 40 };

interface Props {
  readonly name: IconName;
  readonly size?: IconSize;
  readonly tone?: Tone;
  /** label makes the icon announce itself; without one it is decoration and hidden from readers. */
  readonly label?: string;
}

export function Icon({ name, size = "md", tone = "primary", label }: Props) {
  const t = useTheme();
  return (
    <Ionicons
      name={glyphs[name]}
      size={sizes[size]}
      color={toneColor(t, tone)}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
      {...(label ? { accessibilityLabel: label } : {})}
    />
  );
}
