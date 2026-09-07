// SwitchRow is a yes or a no: the label on the left, the platform's own
// switch on the right, the whole row pressable.
import React from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { useStyles, useTheme, type Theme } from "../theme";
import { Text } from "./Text";

interface Props {
  readonly label: string;
  readonly value: boolean;
  readonly onValueChange: (on: boolean) => void;
  readonly disabled?: boolean;
  readonly help?: string;
  readonly testID?: string;
}

export function SwitchRow({ label, value, onValueChange, disabled = false, help, testID }: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  return (
    <Pressable
      style={s.row}
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      {...(testID ? { testID } : {})}
    >
      <View style={s.text}>
        <Text>{label}</Text>
        {help ? (
          <Text role="caption" tone="muted">
            {help}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: t.color.accentDefault, false: t.color.borderDefault }}
        thumbColor={t.color.surfacePrimary}
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    row: {
      minHeight: t.hit,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.space.md,
      paddingVertical: t.space.sm,
    },
    text: { flex: 1, gap: t.space.xs / 2 },
  });
