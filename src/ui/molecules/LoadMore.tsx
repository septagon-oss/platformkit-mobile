// LoadMore is the foot of a list that has more: how many, as a button, or a
// spinner while they come.
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../atoms/Button";
import { Spinner } from "../atoms/Spinner";
import { testable } from "../props";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly remaining: number;
  readonly busy: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
}

export function LoadMore({ remaining, busy, onPress, testID }: Props) {
  const s = useStyles(styles);
  if (remaining <= 0) return null;
  return (
    <View style={s.foot} {...testable(testID)}>
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
