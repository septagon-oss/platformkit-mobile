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
import {
  type Formatting,
  type Names,
  type People,
  type PictureStates,
  personValue,
  badgeTone,
  display,
  enumTone,
  fieldLabel,
  points,
  text,
} from "../../core/present";
import { splitList } from "../../core/form";
import { AvatarStack } from "./AvatarStack";
import type { ImageRenderer } from "./MediaHero";
import { Badge } from "../atoms/Badge";
import { Icon } from "../atoms/Icon";
import { Text } from "../atoms/Text";
import { testable } from "../props";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly decorative?: boolean;
  readonly instance?: string;
  readonly people?: People | undefined;
  readonly pictureStates?: PictureStates | undefined;
  readonly renderImage?: ImageRenderer | undefined;
  readonly presentation: Formatting;
  readonly field: Field;
  readonly value: unknown;
  /** compact is a value on a list row, where there is one line to say it in. */
  readonly compact?: boolean;
  /**
   * names is what this screen resolved of the records its values point at, keyed
   * the way `derive.nameKey` keys them. Absent means nothing was resolved, which
   * is still not the identifier: a pointer says the word (`derive.referenceWord`).
   */
  readonly names?: Names | undefined;
  /** testID names whichever shape the value takes. */
  readonly testID?: string;
}

export function Value({
  presentation,
  field,
  value,
  compact = false,
  decorative = false,
  instance,
  names,
  people,
  pictureStates,
  renderImage,
  testID,
}: Props) {
  const s = useStyles(styles);
  const shown = display(field, value, presentation, names);
  const raw = text(value);
  const id = testable(testID);

  const person = personValue(
    field,
    value,
    presentation,
    names,
    people,
    pictureStates,
    !!renderImage,
    instance,
  );
  if (person?.people.length)
    return <AvatarStack model={person} renderImage={renderImage} decorative={decorative} {...id} />;

  if (raw === "")
    return (
      // The core's word for an empty value: a dash for a field with nothing in it,
      // "Not set" for the switch that was never answered — a pill would claim a
      // state, and there is none to claim.
      <Text role={compact ? "caption" : "body"} tone="muted" {...id}>
        {shown}
      </Text>
    );

  // A closed set is a word, and a word of its own colour is a claim about it, so the
  // colour comes from what the document declared for that value (`enumTones`) and
  // from nothing else. An unlabelled value — including one a closed set does not
  // contain — stays neutral: position in a list is no such fact.
  if (field.enum && field.enum.length > 0)
    return <Badge label={shown} tone={badgeTone(enumTone(field, raw))} {...id} />;

  if (field.type === "bool")
    return <Badge label={shown} tone={value === true ? "ok" : "neutral"} {...id} />;

  if (field.type === "list") {
    const items = splitList(raw);
    return (
      <View style={s.chips} {...id}>
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
      <View style={s.withIcon} {...id}>
        <Icon name="clock" size="sm" tone="muted" />
        <Text role={compact ? "caption" : "body"}>{shown}</Text>
      </View>
    );

  // An identifier is monospaced and selectable because a person reads it out
  // letter by letter. A value that points at another record is not an identifier
  // to anyone: it reads as that record's name, or as the word saying there is one,
  // and both are ordinary words.
  if ((field.type === "uuid" || field.widget === "entity-picker") && !points(field))
    return (
      <Text
        role="mono"
        tone={compact ? "muted" : "primary"}
        numberOfLines={1}
        selectable={!compact}
        {...id}
      >
        {shown}
      </Text>
    );

  if (field.type === "int" || field.type === "float")
    return (
      <Text role="mono" tone={compact ? "muted" : "primary"} {...id}>
        {shown}
      </Text>
    );

  return (
    <Text
      role={compact ? "caption" : "body"}
      tone={compact ? "muted" : "primary"}
      numberOfLines={compact ? 1 : undefined}
      selectable={!compact}
      {...id}
    >
      {shown}
    </Text>
  );
}

/**
 * Labelled is a cell on a list row. A value from a closed set is a word of
 * its own and stands alone; "No" or "2" means nothing without the field it
 * answers, so those keep their name. What a screen reader hears is the row's
 * label, which always names every field.
 */
export function Labelled({
  presentation,
  field,
  value,
  names,
  people,
  pictureStates,
  renderImage,
  instance,
}: {
  readonly presentation: Formatting;
  readonly field: Field;
  readonly value: unknown;
  readonly names?: Names | undefined;
  readonly people?: People | undefined;
  readonly pictureStates?: PictureStates | undefined;
  readonly renderImage?: ImageRenderer | undefined;
  readonly instance?: string;
}) {
  const s = useStyles(styles);
  const speaks = (field.enum ?? []).length > 0;
  return (
    <View style={s.cell}>
      {speaks ? null : (
        <Text role="caption" tone="muted">
          {fieldLabel(field)}
        </Text>
      )}
      <Value
        presentation={presentation}
        {...(instance ? { instance } : {})}
        field={field}
        value={value}
        names={names}
        people={people}
        pictureStates={pictureStates}
        renderImage={renderImage}
        compact
        decorative
      />
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    chips: { flexDirection: "row", flexWrap: "wrap", gap: t.space.xs, alignItems: "center" },
    withIcon: { flexDirection: "row", alignItems: "center", gap: t.space.xs },
    cell: { flexDirection: "row", alignItems: "center", gap: t.space.xs },
  });
