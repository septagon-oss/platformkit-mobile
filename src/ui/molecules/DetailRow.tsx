// DetailRow is one fact about one thing: the term above, the value beneath,
// selectable so a person can copy an identifier.
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../atoms/Text";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly term: string;
  readonly value: string;
  readonly mono?: boolean;
}

export function DetailRow({ term, value, mono = false }: Props) {
  const s = useStyles(styles);
  return (
    <View style={s.row} accessible accessibilityLabel={`${term}, ${value}`}>
      <Text role="caption" tone="muted" uppercase>
        {term}
      </Text>
      <Text role={mono ? "mono" : "body"} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    row: { paddingVertical: t.space.sm, gap: t.space.xs / 2 },
  });
