// Row is how a list shows one thing: its name, up to a few cells beneath, a
// chevron that says it opens. It is a phone's table.
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "../atoms/Icon";
import { Text } from "../atoms/Text";
import { useStyles, useTheme, type Theme } from "../theme";

interface Props {
  readonly title: string;
  readonly cells?: readonly string[];
  readonly onPress?: () => void;
  /** tone colours the title: destructive rows are red and open nothing. */
  readonly tone?: "primary" | "destructive";
  readonly testID?: string;
}

export function Row({ title, cells = [], onPress, tone = "primary", testID }: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const opens = tone === "primary" && !!onPress;
  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && s.pressed]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, ...cells].join(", ")}
      android_ripple={{ color: t.color.borderDefault }}
      {...(testID ? { testID } : {})}
    >
      <View style={s.text}>
        <Text
          weight="semibold"
          tone={tone === "destructive" ? "danger" : "primary"}
          numberOfLines={2}
        >
          {title}
        </Text>
        {cells.length > 0 ? (
          <Text role="caption" tone="muted" numberOfLines={2}>
            {cells.join("  ·  ")}
          </Text>
        ) : null}
      </View>
      {opens ? <Icon name="chevron" size="sm" tone="muted" /> : null}
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    row: {
      minHeight: t.hit,
      flexDirection: "row",
      alignItems: "center",
      gap: t.space.sm,
      paddingVertical: t.space.sm,
    },
    text: { flex: 1, gap: t.space.xs / 2 },
    pressed: { opacity: 0.7 },
  });
