// TextField is one line, or several, of what a person types. A kind decides
// the keyboard and the face; the label, help and error around it belong to
// FormField, so this knows nothing of a form.
import React, { forwardRef } from "react";
import { Platform, StyleSheet, TextInput, type TextInputProps } from "react-native";
import { useStyles, useTheme, type Theme } from "../theme";

export type FieldKind =
  "text" | "textarea" | "number" | "mono" | "url" | "email" | "password" | "search";

interface Props extends Omit<TextInputProps, "style" | "editable"> {
  readonly kind?: FieldKind;
  readonly disabled?: boolean;
  /** invalid draws the danger border; the message is FormField's. */
  readonly invalid?: boolean;
  /** plain lets a molecule own the chrome: the field keeps its keyboard and its face, and no border of its own. */
  readonly plain?: boolean;
}

const keyboards: Record<FieldKind, TextInputProps["keyboardType"]> = {
  text: "default",
  textarea: "default",
  // The number pads have no minus key on iOS; punctuation does.
  number: Platform.select({ ios: "numbers-and-punctuation", default: "numeric" }),
  mono: "ascii-capable",
  url: "url",
  email: "email-address",
  password: "default",
  search: "web-search",
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { kind = "text", disabled = false, invalid = false, plain = false, ...rest },
  ref,
) {
  const t = useTheme();
  const s = useStyles(styles);
  const bare = kind !== "text" && kind !== "textarea" && kind !== "search";
  return (
    <TextInput
      ref={ref}
      editable={!disabled}
      keyboardType={keyboards[kind]}
      autoCapitalize={bare ? "none" : "sentences"}
      autoCorrect={!bare}
      secureTextEntry={kind === "password"}
      multiline={kind === "textarea"}
      numberOfLines={kind === "textarea" ? 5 : 1}
      placeholderTextColor={t.color.textMuted}
      maxFontSizeMultiplier={t.type.body.scale}
      aria-disabled={disabled}
      {...rest}
      style={[
        s.input,
        kind === "textarea" && s.textarea,
        kind === "mono" && s.mono,
        plain && s.plain,
        invalid && s.invalid,
        disabled && s.disabled,
      ]}
    />
  );
});

const styles = (t: Theme) =>
  StyleSheet.create({
    input: {
      minHeight: t.hit,
      paddingHorizontal: t.space.md,
      paddingVertical: t.space.sm,
      fontSize: t.type.body.size,
      color: t.color.textPrimary,
      backgroundColor: t.color.surfacePrimary,
      borderRadius: t.radius.md,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.state.outline,
      ...(t.font.body ? { fontFamily: t.font.body } : {}),
    },
    textarea: { minHeight: t.extent.textarea, textAlignVertical: "top" },
    mono: { fontSize: t.type.mono.size, ...(t.font.mono ? { fontFamily: t.font.mono } : {}) },
    plain: {
      paddingHorizontal: 0,
      borderWidth: 0,
      backgroundColor: "transparent",
      borderRadius: 0,
    },
    invalid: { borderColor: t.color.statusDanger },
    disabled: { opacity: 0.6, backgroundColor: t.color.surfaceMuted },
  });
