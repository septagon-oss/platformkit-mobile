// DateTimeRow is an instant: on iOS the compact date and time controls the
// system draws, inline in the row; on Android the platform's date dialog then
// its time dialog. An optional instant that is not set says so and can be
// set; one that is set can be cleared. The value is a Date; what it means on
// the wire is the core's business. The field's own word is FormField's to draw,
// above this row, as it draws one above a text box.
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import React, { useLayoutEffect, useRef } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import type { Copy } from "../../core/derive";
import { testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Text } from "./Text";

interface Props {
  readonly copy: Copy["dateTime"];
  readonly initialValue: Date;
  readonly timeZone: string;
  /** label is what the field is called: what the row announces and what the platform's dialog is titled by. FormField draws the word a person reads, so this prints none. */
  readonly label: string;
  /** name is what the row announces when the field's own word is not the whole name — a form says whether it is required in the same breath. */
  readonly name?: string;
  readonly value: Date | undefined;
  readonly onChange: (value: Date | undefined) => void;
  /** The caller formats the value in the same explicit zone as the picker. */
  readonly text: (at: Date) => string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly testID?: string;
}

export function DateTimeRow({
  copy,
  initialValue,
  timeZone,
  label,
  name,
  value,
  onChange,
  text,
  disabled = false,
  required = false,
  testID,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const spoken = name ?? label;
  // Android retains callbacks while a native dialog is open. They must honour
  // a newly disabled/unmounted row and report to its current consumer.
  const current = useRef({ disabled, onChange });
  useLayoutEffect(() => {
    current.current = { disabled, onChange };
    return () => {
      current.current = { disabled: true, onChange };
    };
  }, [disabled, onChange]);
  const change = (at: Date) => {
    if (!current.current.disabled) current.current.onChange(at);
  };
  const clear =
    !required && !disabled && value ? (
      <Button label={copy.clear} tone="plain" onPress={() => onChange(undefined)} />
    ) : null;

  if (Platform.OS === "ios") {
    const shown = value ?? initialValue;
    return (
      <View style={s.row} accessibilityLabel={spoken} {...testable(testID)}>
        <View style={s.controls}>
          {value ? (
            <>
              <DateTimePicker
                value={shown}
                mode="date"
                display="compact"
                onValueChange={(_, d) => change(d)}
                timeZoneName={timeZone}
                disabled={disabled}
                themeVariant={t.mode}
                accentColor={t.color.accentDefault}
                {...testable(testID ? `${testID}-date` : undefined)}
              />
              <DateTimePicker
                value={shown}
                mode="time"
                display="compact"
                onValueChange={(_, d) => change(d)}
                timeZoneName={timeZone}
                disabled={disabled}
                themeVariant={t.mode}
                accentColor={t.color.accentDefault}
                {...testable(testID ? `${testID}-time` : undefined)}
              />
              {clear}
            </>
          ) : (
            <Button
              label={copy.set}
              tone="plain"
              onPress={() => change(initialValue)}
              disabled={disabled}
            />
          )}
        </View>
      </View>
    );
  }

  const ask = () => {
    if (disabled) return;
    const start = value ?? initialValue;
    DateTimePickerAndroid.open({
      value: start,
      mode: "date",
      timeZoneName: timeZone,
      onValueChange: (_, day) => {
        if (current.current.disabled) return;
        DateTimePickerAndroid.open({
          value: day,
          mode: "time",
          timeZoneName: timeZone,
          onValueChange: (_, at) => change(at),
        });
      },
    });
  };

  return (
    <View style={s.row} {...testable(testID)}>
      <Pressable
        style={s.press}
        onPress={ask}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={spoken}
        aria-valuetext={value ? text(value) : copy.notSet}
        accessibilityHint={copy.openHint}
        aria-disabled={disabled}
      >
        <View style={s.value}>
          <Icon name="calendar" size="sm" tone="muted" />
          <Text style={s.label} tone={value ? "primary" : "muted"} maxFontSizeMultiplier={0}>
            {value ? text(value) : copy.notSet}
          </Text>
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
    value: { flexDirection: "row", alignItems: "center", gap: t.space.xs, flexShrink: 1 },
    label: { flexShrink: 1 },
  });
