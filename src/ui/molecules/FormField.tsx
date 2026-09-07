// FormField is a control with its name, its help and, when the server
// refused it, the refusal under it where the eye already is. The error is
// announced, so a screen reader hears what a sighted person sees.
import React, { useEffect, type ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import { Text } from "../atoms/Text";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly label: string;
  readonly required?: boolean;
  readonly help?: string;
  readonly error?: string;
  /** bare rows (a switch, a choice) carry their own label; the field then shows only help and error. */
  readonly bare?: boolean;
  readonly children: ReactNode;
  readonly testID?: string;
}

export function FormField({
  label,
  required = false,
  help,
  error,
  bare = false,
  children,
  testID,
}: Props) {
  const s = useStyles(styles);
  useEffect(() => {
    if (error && Platform.OS === "ios")
      AccessibilityInfo.announceForAccessibility(`${label}: ${error}`);
  }, [error, label]);
  return (
    <View style={s.field} {...(testID ? { testID } : {})}>
      {bare ? null : (
        <Text role="caption" tone="muted" weight="semibold">
          {label}
          {required ? " *" : ""}
        </Text>
      )}
      {children}
      {error ? (
        <Text role="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {help ? (
        <Text role="caption" tone="muted">
          {help}
        </Text>
      ) : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    field: { gap: t.space.xs, paddingVertical: t.space.sm },
  });
