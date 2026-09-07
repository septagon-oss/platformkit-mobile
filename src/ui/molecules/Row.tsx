// Row is how a list shows one thing: its name, up to a few cells beneath, a
// chevron that says it opens. It is a phone's table.
import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "../atoms/Icon";
import { Spinner } from "../atoms/Spinner";
import { Text } from "../atoms/Text";
import { useStyles, useTheme, type Theme } from "../theme";

interface Props {
  readonly title: string;
  /** cells are what a screen reader hears, and what is shown when nothing else is given. */
  readonly cells?: readonly string[];
  /** summary is a line of the record's own words, under its name. */
  readonly summary?: string;
  /** shown replaces those cells with the values in the shapes their types deserve. */
  readonly shown?: ReactNode;
  readonly onPress?: () => void;
  /** tone colours the title: destructive rows are red and open nothing. */
  readonly tone?: "primary" | "destructive";
  /** busy is a row whose press is under way: the chevron becomes a spinner and the press is off. */
  readonly busy?: boolean;
  /** opens says pressing leads somewhere, which is what the chevron promises. */
  readonly opens?: boolean;
  readonly testID?: string;
}

export function Row({
  title,
  cells = [],
  summary,
  shown,
  onPress,
  tone = "primary",
  busy = false,
  opens: leads,
  testID,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const opens = (leads ?? true) && tone === "primary" && !!onPress;
  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && s.pressed]}
      onPress={onPress}
      disabled={!onPress || busy}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: !onPress || busy }}
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
        {summary ? (
          <Text role="label" tone="muted" numberOfLines={2}>
            {summary}
          </Text>
        ) : null}
        {shown ? (
          <View style={s.cells}>{shown}</View>
        ) : cells.length > 0 ? (
          <Text role="caption" tone="muted" numberOfLines={2}>
            {cells.join("  ·  ")}
          </Text>
        ) : null}
      </View>
      {busy ? <Spinner /> : opens ? <Icon name="chevron" size="sm" tone="muted" /> : null}
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
    cells: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: t.space.sm },
    pressed: { opacity: 0.7 },
  });
