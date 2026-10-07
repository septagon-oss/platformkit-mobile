// Row is how a list shows one thing: its name, up to a few cells beneath, a
// chevron that says it opens. It is a phone's table.
import React, { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "../atoms/Icon";
import { Spinner } from "../atoms/Spinner";
import { Text } from "../atoms/Text";
import { chosenState, testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";

interface Props {
  readonly title: string;
  /** eyebrow is the category the row sits in, above its name. */
  readonly eyebrow?: string;
  /** cells are what a screen reader hears, and what is shown when nothing else is given. */
  readonly cells?: readonly string[];
  /** summary is a line of the record's own words, under its name. */
  readonly summary?: string;
  /** shown replaces those cells with the values in the shapes their types deserve. */
  readonly shown?: ReactNode;
  /** trailing is the row's reserved right column: the number, pill or tick a scan reads down. */
  readonly trailing?: ReactNode;
  readonly onPress?: () => void;
  /** tone says what pressing the row does: a destructive row is red and opens nothing. */
  readonly tone?: "primary" | "destructive";
  /** busy is a row whose press is under way: the chevron becomes a spinner and the press is off. */
  readonly busy?: boolean;
  /** selected is the row a filter or a single choice stands on, not a row being pressed. */
  readonly selected?: boolean;
  /** opens says pressing leads somewhere, which is what the chevron promises. */
  readonly opens?: boolean;
  readonly testID?: string;
}

export function Row({
  title,
  eyebrow,
  cells = [],
  summary,
  shown,
  trailing,
  onPress,
  tone = "primary",
  busy = false,
  selected,
  opens: leads,
  testID,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const [hovered, setHovered] = useState(false);
  const opens = (leads ?? true) && tone === "primary" && !!onPress;
  return (
    <Pressable
      style={({ pressed }) => [
        s.row,
        hovered && !pressed && !selected && onPress && s.hover,
        pressed && !!onPress && s.press,
        selected && s.selected,
      ]}
      onPress={onPress}
      disabled={!onPress || busy}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      aria-busy={busy}
      aria-disabled={!onPress || busy}
      {...chosenState("button", selected)}
      accessibilityLabel={[eyebrow, title, ...cells].filter(Boolean).join(", ")}
      android_ripple={{ color: t.color.borderDefault }}
      {...testable(testID)}
    >
      {selected !== undefined ? (
        <Icon name={selected ? "check" : "circle"} size="sm" tone={selected ? "accent" : "muted"} />
      ) : null}
      <View style={s.text}>
        {eyebrow ? (
          <Text role="eyebrow" tone="muted" uppercase numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
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
      {busy ? <Spinner label={title} motion="reduced" /> : null}
      {trailing ? <View style={s.trailing}>{trailing}</View> : null}
      {opens && !busy ? <Icon name="chevron" size="sm" tone="muted" /> : null}
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
      borderBottomWidth: 1,
      borderBottomColor: t.state.divider,
    },
    text: { flex: 1, gap: t.space.xs / 2 },
    cells: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: t.space.sm },
    trailing: { alignItems: "flex-end", gap: t.space.xs / 2 },
    hover: { backgroundColor: t.state.hovered },
    press: { backgroundColor: t.state.pressed },
    selected: { backgroundColor: t.state.selected },
  });
