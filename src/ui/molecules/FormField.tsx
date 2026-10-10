// FormField is a control with its name, its help and, when the server
// refused it, the refusal under it where the eye already is. The name sits
// above the control whatever the control is — a text box, a switch, a picker,
// a date row — because a sheet whose rows were named two different ways is a
// sheet a person reads twice. The error is announced, so a screen reader
// hears what a sighted person sees.
import React, { useEffect, type ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import type { KitWords } from "../../core/kitCopy";
import { Text } from "../atoms/Text";
import { testable } from "../props";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly label: string;
  /**
   * required is what a form says about the field it is drawing. A false field is
   * marked beside its label with the reader's own word, because a person who is not
   * asked for something should be told they may leave it; a true field is answered
   * by the control's own name, and no asterisk stands in for either word — a star
   * says nothing to the person reading it and nothing at all to the one hearing it.
   * A control that is nobody's form field, like the gallery's own pickers, is given
   * neither and is marked none.
   */
  readonly required?: boolean;
  /** copy is the reader's pair of words, handed over with the `required` that asks for them. */
  readonly copy?: Pick<KitWords, "required" | "optional">;
  readonly help?: string;
  readonly error?: string;
  readonly children: ReactNode;
  readonly testID?: string;
}

export function FormField({ label, required, copy, help, error, children, testID }: Props) {
  const s = useStyles(styles);
  useEffect(() => {
    if (error && Platform.OS === "ios")
      AccessibilityInfo.announceForAccessibility(`${label}: ${error}`);
  }, [error, label]);
  const mark = required === false && copy ? copy.optional : "";
  return (
    <View style={s.field} {...testable(testID)}>
      <Text role="caption" tone="muted" weight="semibold">
        {mark ? `${label} (${mark})` : label}
      </Text>
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
