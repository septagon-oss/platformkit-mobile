// Value is a field's value as this medium shows it. The text is always the
// core's `display`, so a phone and a browser say the same thing; what differs
// is the shape it is said in, because a phone has no columns to align and a
// glance has to do the work a table header does elsewhere.
//
// The shape comes from the schema and nothing else: a closed set of values is
// a badge, a yes or no is a badge, an instant carries a clock, an identifier
// is monospaced, a list is chips, a number is monospaced so digits line up.
import React from "react";
import { View, StyleSheet } from "react-native";
import type { Field } from "../../core/catalog";
import { display, humanize, splitList, text } from "../../core/derive";
import { Badge, type BadgeTone } from "../atoms/Badge";
import { Icon } from "../atoms/Icon";
import { Text } from "../atoms/Text";
import { useStyles, type Theme } from "../theme";

/**
 * tone gives each value of a closed set its own colour. The schema orders
 * those values and the order is the only signal there is, so the first is
 * informational and the rest walk the status colours; nothing here pretends
 * to know that "done" is good or "archived" is bad.
 */
const tones: readonly BadgeTone[] = ["info", "ok", "warning", "danger"];
export function enumTone(f: Field, value: string): BadgeTone {
  const i = (f.enum ?? []).indexOf(value);
  return i < 0 ? "neutral" : (tones[i % tones.length] ?? "neutral");
}

interface Props {
  readonly field: Field;
  readonly value: unknown;
  /** compact is a value on a list row, where there is one line to say it in. */
  readonly compact?: boolean;
}

export function Value({ field, value, compact = false }: Props) {
  const s = useStyles(styles);
  const shown = display(field, value);
  const raw = text(value);

  if (raw === "")
    return (
      <Text role={compact ? "caption" : "body"} tone="muted">
        —
      </Text>
    );

  if (field.enum && field.enum.length > 0)
    return <Badge label={shown} tone={enumTone(field, raw)} />;

  if (field.type === "bool")
    return <Badge label={shown} tone={value === true ? "ok" : "neutral"} />;

  if (field.type === "list") {
    const items = splitList(raw);
    return (
      <View style={s.chips}>
        {items.slice(0, compact ? 3 : items.length).map((item) => (
          <Badge key={item} label={item} />
        ))}
        {compact && items.length > 3 ? (
          <Text role="caption" tone="muted">{`+${items.length - 3}`}</Text>
        ) : null}
      </View>
    );
  }

  if (field.type === "time")
    return (
      <View style={s.withIcon}>
        <Icon name="clock" size="sm" tone="muted" />
        <Text role={compact ? "caption" : "body"}>{shown}</Text>
      </View>
    );

  if (field.type === "uuid" || field.widget === "entity-picker")
    return (
      <Text
        role="mono"
        tone={compact ? "muted" : "primary"}
        numberOfLines={1}
        selectable={!compact}
      >
        {shown}
      </Text>
    );

  if (field.type === "int" || field.type === "float")
    return (
      <Text role="mono" tone={compact ? "muted" : "primary"}>
        {shown}
      </Text>
    );

  return (
    <Text
      role={compact ? "caption" : "body"}
      tone={compact ? "muted" : "primary"}
      numberOfLines={compact ? 1 : undefined}
      selectable={!compact}
    >
      {shown}
    </Text>
  );
}

/** Labelled is a value with its field's name in front, for a list row's cells. */
export function Labelled({ field, value }: { readonly field: Field; readonly value: unknown }) {
  const s = useStyles(styles);
  return (
    <View style={s.cell}>
      <Text role="caption" tone="muted">
        {humanize(field.name)}
      </Text>
      <Value field={field} value={value} compact />
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    chips: { flexDirection: "row", flexWrap: "wrap", gap: t.space.xs, alignItems: "center" },
    withIcon: { flexDirection: "row", alignItems: "center", gap: t.space.xs },
    cell: { flexDirection: "row", alignItems: "center", gap: t.space.xs },
  });
