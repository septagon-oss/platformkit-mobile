// Row is how a list shows one thing: its name, up to a few cells beneath, a
// chevron that says it opens. It is a phone's table. A row draws no separator of
// its own: the group it sits in separates its rows, so a row outside a group is
// one thing on a page and not a fragment of a table.
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
  readonly cells?: readonly RowCell[];
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
  /**
   * role is which control this row is to a reader. A row on a list is a button that
   * opens something; a row that *is* the choice — one line of a sheet of orders — is a
   * radio, and a group of them is read down as one question.
   */
  readonly role?: "button" | "radio";
  /** opens says pressing leads somewhere, which is what the chevron promises. */
  readonly opens?: boolean;
  readonly testID?: string;
}

/**
 * RowCell is one value under a row's name. The eye reads `value` and a reader
 * hears `spoken` when there is one: a time is shown as a distance and said as the
 * whole local date-time, so a row that reads "Created: 5 minutes ago" says
 * "Created: 1 Jul 2026, 13:00". A cell with no label is the value alone.
 */
export interface RowCell {
  readonly label?: string;
  readonly value: string;
  readonly spoken?: string;
}

/** said is one cell as words — the shorthand the eye reads, or the fact a reader hears. */
const said = (cell: RowCell, aloud: boolean): string =>
  [cell.label, aloud ? (cell.spoken ?? cell.value) : cell.value]
    .filter((part): part is string => !!part)
    .join(": ");

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
  role = "button",
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
      accessibilityRole={role}
      aria-busy={busy}
      aria-disabled={!onPress || busy}
      {...chosenState(role, selected)}
      accessibilityLabel={[eyebrow, title, ...cells.map((cell) => said(cell, true))]
        .filter(Boolean)
        .join(", ")}
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
            {cells.map((cell) => said(cell, false)).join("  ·  ")}
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
    },
    text: { flex: 1, gap: t.space.xs / 2 },
    cells: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: t.space.sm },
    trailing: { alignItems: "flex-end", gap: t.space.xs / 2 },
    hover: { backgroundColor: t.state.hovered },
    press: { backgroundColor: t.state.pressed },
    selected: { backgroundColor: t.state.selected },
  });
