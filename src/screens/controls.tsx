// controls.tsx is one field's input, decided by the derived Control's kind. It
// is the only file that knows what a "select" looks like on a phone.
import React from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { Control } from "../core/derive";
import { color, font, radius, space } from "./theme";

interface Props {
  readonly control: Control;
  readonly value: string;
  readonly error?: string;
  readonly onChange: (value: string) => void;
}

export function ControlView({ control, value, error, onChange }: Props) {
  const disabled = control.readOnly;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {control.label}
        {control.required ? " *" : ""}
      </Text>
      {input(control, value, disabled, onChange)}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {control.help ? <Text style={styles.help}>{control.help}</Text> : null}
    </View>
  );
}

function input(c: Control, value: string, disabled: boolean, onChange: (v: string) => void) {
  switch (c.kind) {
    case "switch":
      return (
        <Switch
          value={value === "true"}
          disabled={disabled}
          onValueChange={(on) => onChange(on ? "true" : "false")}
          accessibilityLabel={c.label}
        />
      );
    case "select":
      return (
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={c.label}>
          {c.options.map((o) => {
            const on = o.value === value;
            return (
              <Pressable
                key={o.value}
                disabled={disabled}
                onPress={() => onChange(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled }}
                style={[styles.chip, on && styles.chipOn, disabled && styles.disabled]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      );
    case "textarea":
      return (
        <TextInput
          style={[styles.input, styles.textarea, disabled && styles.disabled]}
          value={value}
          editable={!disabled}
          multiline
          numberOfLines={5}
          onChangeText={onChange}
          accessibilityLabel={c.label}
        />
      );
    case "number":
      return (
        <TextInput
          style={[styles.input, disabled && styles.disabled]}
          value={value}
          editable={!disabled}
          keyboardType="numeric"
          onChangeText={onChange}
          accessibilityLabel={c.label}
        />
      );
    case "datetime":
      return (
        <TextInput
          style={[styles.input, disabled && styles.disabled]}
          value={value}
          editable={!disabled}
          placeholder="2026-01-31T09:00:00Z"
          autoCapitalize="none"
          onChangeText={onChange}
          accessibilityLabel={c.label}
        />
      );
    default:
      return (
        <TextInput
          style={[styles.input, disabled && styles.disabled]}
          value={value}
          editable={!disabled}
          autoCapitalize={c.kind === "reference" || c.kind === "list" ? "none" : "sentences"}
          onChangeText={onChange}
          accessibilityLabel={c.label}
        />
      );
  }
}

const styles = StyleSheet.create({
  field: { gap: space.xs, marginBottom: space.lg },
  label: { fontSize: font.sm, fontWeight: "600", color: color.text },
  help: { fontSize: font.xs, color: color.textMuted },
  error: { fontSize: font.xs, color: color.danger },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: font.md,
    color: color.text,
    backgroundColor: color.surface,
  },
  textarea: { minHeight: 120, textAlignVertical: "top" },
  disabled: { opacity: 0.6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: color.surface,
  },
  chipOn: { backgroundColor: color.accent, borderColor: color.accent },
  chipText: { color: color.text, fontSize: font.sm },
  chipTextOn: { color: color.accentOn },
});
