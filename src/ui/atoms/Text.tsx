// Text is every word on a screen: a role decides its size, line and how far
// Dynamic Type may grow it; a tone decides its colour. Nothing else sets a
// font size.
import React from "react";
import { Text as Native, type StyleProp, type TextProps, type TextStyle } from "react-native";
import type { Role } from "../scale";
import { useTheme, type Theme } from "../theme";

export type Tone = "primary" | "muted" | "accent" | "danger" | "on";
export type Weight = "regular" | "semibold" | "bold";

export interface Props extends Omit<TextProps, "style" | "role"> {
  readonly role?: Role;
  readonly tone?: Tone;
  readonly weight?: Weight;
  readonly align?: "left" | "center" | "right";
  readonly uppercase?: boolean;
  readonly style?: StyleProp<TextStyle>;
}

const weights: Record<Weight, TextStyle["fontWeight"]> = {
  regular: "400",
  semibold: "600",
  bold: "700",
};

export function toneColor(t: Theme, tone: Tone): string {
  switch (tone) {
    case "muted":
      return t.color.textMuted;
    case "accent":
      return t.color.accentDefault;
    case "danger":
      return t.color.statusDanger;
    case "on":
      return t.color.accentOn;
    default:
      return t.color.textPrimary;
  }
}

export function Text({
  role = "body",
  tone = "primary",
  weight = "regular",
  align,
  uppercase,
  style,
  children,
  ...rest
}: Props) {
  const t = useTheme();
  const metrics = t.type[role];
  const family = role === "mono" ? t.font.mono : role === "display" ? t.font.display : t.font.body;
  return (
    <Native
      maxFontSizeMultiplier={metrics.scale}
      {...rest}
      style={[
        {
          fontSize: metrics.size,
          lineHeight: metrics.line,
          color: toneColor(t, tone),
          fontWeight: weights[weight],
          ...(family ? { fontFamily: family } : {}),
          ...(align ? { textAlign: align } : {}),
          ...(uppercase ? { textTransform: "uppercase" as const, letterSpacing: 0.6 } : {}),
        },
        style,
      ]}
    >
      {children}
    </Native>
  );
}
