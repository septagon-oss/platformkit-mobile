// Badge is a status as a soft pill: one of the four status pairs the palette
// carries, or neutral.
import React from "react";
import { StyleSheet, View } from "react-native";
import { testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";
import { Text } from "./Text";

export type BadgeTone = "ok" | "warning" | "danger" | "info" | "neutral";

interface Props {
  readonly label: string;
  readonly tone?: BadgeTone;
  readonly testID?: string;
}

export function Badge({ label, tone = "neutral", testID }: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const [fg, bg] =
    tone === "ok"
      ? [t.color.statusOk, t.color.statusOkBg]
      : tone === "warning"
        ? [t.color.statusWarning, t.color.statusWarningBg]
        : tone === "danger"
          ? [t.color.statusDanger, t.color.statusDangerBg]
          : tone === "info"
            ? [t.color.statusInfo, t.color.statusInfoBg]
            : [t.color.textMuted, t.color.surfaceMuted];
  return (
    <View
      style={[s.pill, { backgroundColor: bg }]}
      accessibilityLabel={label}
      {...testable(testID)}
    >
      <Text role="caption" weight="semibold" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    pill: {
      alignSelf: "flex-start",
      borderRadius: t.radius.full,
      paddingHorizontal: t.space.sm,
      paddingVertical: t.space.xs / 2,
    },
  });
