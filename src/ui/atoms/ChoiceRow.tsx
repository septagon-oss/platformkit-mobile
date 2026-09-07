// ChoiceRow is one of a few: a row that shows what is chosen and asks the
// platform's own chooser for another. On iOS that is the action sheet; on
// Android and elsewhere it is the picker's dialog. Nothing here imitates
// either.
import { Picker } from "@react-native-picker/picker";
import React from "react";
import { ActionSheetIOS, Platform, Pressable, StyleSheet, View } from "react-native";
import { useStyles, useTheme, type Theme } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface Option {
  readonly value: string;
  readonly label: string;
}

interface Props {
  readonly label: string;
  readonly value: string;
  readonly options: readonly Option[];
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly testID?: string;
}

export function ChoiceRow({
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Choose",
  testID,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const chosen = options.find((o) => o.value === value);
  const shown = chosen?.label ?? (value || placeholder);

  if (Platform.OS === "ios") {
    const ask = () =>
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: label,
          options: [...options.map((o) => o.label), "Cancel"],
          cancelButtonIndex: options.length,
          userInterfaceStyle: t.mode,
        },
        (index) => {
          const picked = options[index];
          if (picked) onChange(picked.value);
        },
      );
    return (
      <Pressable
        style={s.row}
        onPress={ask}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: shown }}
        accessibilityState={{ disabled }}
        accessibilityHint="Opens the choices"
        {...(testID ? { testID } : {})}
      >
        <Text>{label}</Text>
        <View style={s.value}>
          <Text tone={chosen ? "primary" : "muted"} numberOfLines={1}>
            {shown}
          </Text>
          <Icon name="chevron" size="sm" tone="muted" />
        </View>
      </Pressable>
    );
  }

  return (
    <View style={s.row} accessibilityLabel={label} {...(testID ? { testID } : {})}>
      <Text>{label}</Text>
      <View style={s.picker}>
        <Picker
          selectedValue={value}
          onValueChange={(v) => onChange(String(v))}
          enabled={!disabled}
          mode="dialog"
          prompt={label}
          dropdownIconColor={t.color.textMuted}
          style={s.pickerInner}
          accessibilityLabel={label}
        >
          {chosen ? null : <Picker.Item label={placeholder} value="" color={t.color.textMuted} />}
          {options.map((o) => (
            <Picker.Item
              key={o.value}
              label={o.label}
              value={o.value}
              color={t.color.textPrimary}
            />
          ))}
        </Picker>
      </View>
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
      gap: t.space.md,
    },
    value: { flexDirection: "row", alignItems: "center", gap: t.space.xs, flexShrink: 1 },
    picker: { flex: 1, maxWidth: "60%" },
    pickerInner: { color: t.color.textPrimary, backgroundColor: "transparent" },
  });
