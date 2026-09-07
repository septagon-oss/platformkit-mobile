// LoadMore is the foot of a list that has more: how many, as a button, or a
// spinner while they come.
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../atoms/Button";
import { Spinner } from "../atoms/Spinner";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly remaining: number;
  readonly busy: boolean;
  readonly onPress: () => void;
}

export function LoadMore({ remaining, busy, onPress }: Props) {
  const s = useStyles(styles);
  if (remaining <= 0) return null;
  return (
    <View style={s.foot}>
      {busy ? (
        <Spinner />
      ) : (
        <Button label={`Load ${remaining} more`} onPress={onPress} tone="plain" />
      )}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    foot: { alignItems: "center", padding: t.space.md },
  });
