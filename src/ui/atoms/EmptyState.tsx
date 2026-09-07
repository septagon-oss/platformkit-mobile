// EmptyState is a list with nothing in it, said plainly, with the one thing
// a person can do about it when there is one.
import React from "react";
import { StyleSheet, View } from "react-native";
import { useStyles, type Theme } from "../theme";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

interface Props {
  readonly icon?: IconName;
  readonly title: string;
  readonly text?: string;
  readonly action?: { readonly label: string; readonly onPress: () => void };
}

export function EmptyState({ icon = "empty", title, text, action }: Props) {
  const s = useStyles(styles);
  return (
    <View style={s.box}>
      <Icon name={icon} size="lg" tone="muted" />
      <Text role="title" weight="semibold" align="center">
        {title}
      </Text>
      {text ? (
        <Text tone="muted" align="center">
          {text}
        </Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} tone="secondary" /> : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    box: { alignItems: "center", gap: t.space.md, padding: t.space.xl },
  });
