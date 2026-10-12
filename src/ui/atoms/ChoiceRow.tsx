// ChoiceRow is one of a few: a row that shows what is chosen and asks the
// platform's own chooser for another. On iOS that is the action sheet; on
// Android and elsewhere it is the picker's dialog. Nothing here imitates
// either, and nothing here prints the field's name: FormField draws it above
// the control, the way it draws a text field's.
import { Picker } from "@react-native-picker/picker";
import React from "react";
import { ActionSheetIOS, Platform, Pressable, StyleSheet, View } from "react-native";
import type { Copy } from "../../core/derive";
import { testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface Option {
  readonly value: string;
  readonly label: string;
}

interface Props {
  readonly copy: Copy["choice"];
  /** label is what the field is called: the chooser's own title, so a person knows which fact the dialog is about. FormField prints the word a person reads, so this prints none. */
  readonly label: string;
  /** name is what the row announces when the field's own word is not the whole name — a form says whether it is required in the same breath. */
  readonly name?: string;
  readonly value: string;
  readonly options: readonly Option[];
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly testID?: string;
}

export function ChoiceRow({
  copy,
  label,
  name,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = copy.placeholder,
  testID,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const chosen = options.find((o) => o.value === value);
  const shown = chosen?.label ?? (value || placeholder);
  const spoken = name ?? label;

  if (Platform.OS === "ios") {
    const ask = () =>
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: label,
          options: [...options.map((o) => o.label), copy.cancel],
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
        accessibilityLabel={spoken}
        aria-valuetext={shown}
        aria-disabled={disabled}
        accessibilityHint={copy.hint}
        {...testable(testID)}
      >
        <View style={s.value}>
          <Text tone={chosen ? "primary" : "muted"} maxFontSizeMultiplier={0}>
            {shown}
          </Text>
          <Icon name="chevron" size="sm" tone="muted" />
        </View>
      </Pressable>
    );
  }

  return (
    <View style={s.row} accessibilityLabel={spoken} {...testable(testID)}>
      <View style={s.picker}>
        <Picker
          selectedValue={value}
          onValueChange={(v) => onChange(String(v))}
          enabled={!disabled}
          mode="dialog"
          prompt={label}
          dropdownIconColor={t.color.textMuted}
          style={s.pickerInner}
          accessibilityLabel={spoken}
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
    // The row holds one thing now that the name sits above it, so the control takes
    // the field's whole width the way a text box does: the same measure down the
    // sheet, and the largest tap target the row can give a chooser.
    row: {
      minHeight: t.hit,
      flexDirection: "row",
      alignItems: "center",
      gap: t.space.md,
    },
    value: { flexDirection: "row", alignItems: "center", gap: t.space.xs, flexShrink: 1 },
    picker: { flex: 1, minWidth: t.extent.choiceMin },
    pickerInner: { color: t.color.textPrimary, backgroundColor: "transparent", minHeight: t.hit },
  });
