// DetailRow is one fact about one thing: the term above, the value beneath,
// selectable so a person can copy an identifier.
import React, { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../atoms/Text";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly term: string;
  /** value is what a screen reader hears, and what a row without a shape shows. */
  readonly value: string;
  /** shown replaces that text with the value in the shape its type deserves. */
  readonly shown?: ReactNode;
}

export function DetailRow({ term, value, shown }: Props) {
  const s = useStyles(styles);
  return (
    <View style={s.row} accessible accessibilityLabel={`${term}, ${value}`}>
      <Text role="caption" tone="muted" uppercase>
        {term}
      </Text>
      {shown ?? <Text selectable>{value}</Text>}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    row: { paddingVertical: t.space.sm, gap: t.space.xs / 2 },
  });
