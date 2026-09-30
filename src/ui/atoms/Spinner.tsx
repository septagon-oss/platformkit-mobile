// Spinner is waiting, in the accent colour, centred when it is the whole screen.
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { Motion } from "../../core/derive";
import { testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";
import { Icon } from "./Icon";

interface Props {
  readonly size?: "small" | "large";
  /** fill centres the spinner in all the space there is. */
  readonly fill?: boolean;
  readonly label: string;
  readonly motion: Motion;
  readonly testID?: string;
}

export function Spinner({ size = "small", fill = false, label, motion, testID }: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const indicator = (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      accessibilityLabel={label}
      {...testable(testID)}
    >
      {motion === "reduced" ? (
        <Icon name="clock" size={size === "large" ? "lg" : "sm"} tone="accent" />
      ) : (
        <ActivityIndicator
          size={size}
          color={t.color.accentDefault}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </View>
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
