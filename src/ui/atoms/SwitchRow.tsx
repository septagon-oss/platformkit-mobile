// SwitchRow is a yes or a no: the platform's own switch, the whole row pressable.
// The word above it belongs to FormField, so this prints no label of its own.
import React from "react";
import { Pressable, StyleSheet, Switch } from "react-native";
import { testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";

interface Props {
  /** label is what the field is called: the name the control announces and the title of the dialog it opens. The word a person reads above the control is FormField's, so this prints nothing. */
  readonly label: string;
  /** name is what the control announces when the field's own word is not the whole name — a form says whether it is required in the same breath. */
  readonly name?: string;
  readonly value: boolean;
  readonly onValueChange: (on: boolean) => void;
  readonly disabled?: boolean;
  readonly testID?: string;
}

export function SwitchRow({ label, name, value, onValueChange, disabled = false, testID }: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  return (
    <Pressable
      style={s.row}
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={name ?? label}
      aria-checked={value}
      aria-disabled={disabled}
      {...testable(testID)}
    >
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: t.color.accentDefault, false: t.state.outline }}
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
  });
