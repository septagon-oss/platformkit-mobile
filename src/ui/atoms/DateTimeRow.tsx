// DateTimeRow is an instant: on iOS the compact date and time controls the
// system draws, inline in the row; on Android the platform's date dialog then
// its time dialog. An optional instant that is not set says so and can be
// set; one that is set can be cleared. The value is a Date; what it means on
// the wire is the core's business.
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useStyles, useTheme, type Theme } from "../theme";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Text } from "./Text";

interface Props {
  readonly label: string;
  readonly value: Date | undefined;
  readonly onChange: (value: Date | undefined) => void;
  /** text is how the value reads here; the core knows the zone, this does not. */
  readonly text: (at: Date) => string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly testID?: string;
}

export function DateTimeRow({
  label,
  value,
  onChange,
  text,
  disabled = false,
  required = false,
  testID,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const clear =
    !required && value ? (
      <Button label="Clear" tone="plain" onPress={() => onChange(undefined)} />
    ) : null;

  if (Platform.OS === "ios") {
    const shown = value ?? new Date();
    return (
      <View style={s.row} accessibilityLabel={label} {...(testID ? { testID } : {})}>
        <Text>{label}</Text>
        <View style={s.controls}>
          {value ? (
            <>
              <DateTimePicker
                value={shown}
                mode="date"
                display="compact"
                onChange={(_, d) => d && onChange(d)}
                disabled={disabled}
                themeVariant={t.mode}
                accentColor={t.color.accentDefault}
              />
              <DateTimePicker
                value={shown}
                mode="time"
                display="compact"
                onChange={(_, d) => d && onChange(d)}
                disabled={disabled}
                themeVariant={t.mode}
                accentColor={t.color.accentDefault}
              />
              {clear}
            </>
          ) : (
            <Button
              label="Set"
              tone="plain"
              onPress={() => onChange(new Date())}
              disabled={disabled}
            />
          )}
        </View>
      </View>
    );
  }

  const ask = () => {
    const start = value ?? new Date();
    DateTimePickerAndroid.open({
      value: start,
      mode: "date",
      onChange: (event, day) => {
        if (event.type !== "set" || !day) return;
        DateTimePickerAndroid.open({
          value: day,
          mode: "time",
          onChange: (e, at) => {
            if (e.type === "set" && at) onChange(at);
          },
        });
      },
    });
  };

  return (
    <View style={s.row} {...(testID ? { testID } : {})}>
      <Pressable
        style={s.press}
        onPress={ask}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value ? text(value) : "Not set" }}
        accessibilityHint="Opens the date and time dialogs"
      >
        <Text>{label}</Text>
        <View style={s.value}>
          <Icon name="calendar" size="sm" tone="muted" />
          <Text tone={value ? "primary" : "muted"}>{value ? text(value) : "Not set"}</Text>
        </View>
      </Pressable>
      {clear}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    row: {
      minHeight: t.hit,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.space.sm,
      flexWrap: "wrap",
    },
    press: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.space.sm,
      minHeight: t.hit,
    },
    controls: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.space.xs,
      flexWrap: "wrap",
      justifyContent: "flex-end",
    },
    value: { flexDirection: "row", alignItems: "center", gap: t.space.xs },
  });
