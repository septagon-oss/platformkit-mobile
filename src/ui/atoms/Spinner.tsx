// Spinner is waiting, in the accent colour, centred when it is the whole screen.
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useStyles, useTheme, type Theme } from "../theme";

interface Props {
  readonly size?: "small" | "large";
  /** fill centres the spinner in all the space there is. */
  readonly fill?: boolean;
  readonly label?: string;
}

export function Spinner({ size = "small", fill = false, label = "Loading" }: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const indicator = (
    <ActivityIndicator size={size} color={t.color.accentDefault} accessibilityLabel={label} />
  );
  return fill ? <View style={s.fill}>{indicator}</View> : indicator;
}

const styles = (t: Theme) =>
  StyleSheet.create({
    fill: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: t.space.xl,
      backgroundColor: t.color.surfaceCanvas,
    },
  });
