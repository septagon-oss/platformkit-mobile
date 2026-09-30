// Button is the one way an action is offered. A tone says what pressing it
// does to the world; a placement says where it sits, because a button in the
// native header is a word in the accent colour and a button on a page is a
// filled shape, and both are this component.
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type ViewStyle,
} from "react-native";
import type { Motion } from "../../core/derive";
import { testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";
import { Icon, type IconName } from "./Icon";
import { Text, toneColor, type Tone as TextTone } from "./Text";

export type ButtonTone = "primary" | "secondary" | "destructive" | "plain";
export type Placement = "inline" | "header";

interface Props {
  readonly label: string;
  readonly onPress: () => void;
  readonly tone?: ButtonTone;
  readonly placement?: Placement;
  readonly icon?: IconName;
  readonly busy?: boolean;
  readonly disabled?: boolean;
  readonly reason?: string;
  readonly hint?: string;
  /** Unresolved preferences stay still. Screens supply normal motion explicitly. */
  readonly motion?: Motion;
  readonly testID?: string;
  readonly accessibilityRole?: AccessibilityRole;
  readonly selected?: boolean;
  readonly checked?: boolean | "mixed";
  readonly expanded?: boolean;
}

export function Button({
  label,
  onPress,
  tone = "primary",
  placement = "inline",
  icon,
  busy = false,
  disabled = false,
  reason,
  hint,
  motion = "reduced",
  testID,
  accessibilityRole = "button",
  selected,
  checked,
  expanded,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const off = disabled || busy;
  const activate = () => {
    if (!off) onPress();
  };
  const header = placement === "header";
  const filled = !header && (tone === "primary" || tone === "destructive");
  const textTone: TextTone = off
    ? "primary"
    : filled
      ? "on"
      : tone === "destructive"
        ? "danger"
        : header || tone === "plain"
          ? "accent"
          : "primary";
  const shape: ViewStyle[] = [s.base];
  if (header) shape.push(s.header);
  else if (tone === "primary") shape.push(s.primary);
  else if (tone === "destructive") shape.push(s.destructive);
  else if (tone === "secondary") shape.push(s.secondary);
  else shape.push(s.plain);
  return (
    <Pressable
      onPress={activate}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      disabled={off}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      {...(reason || hint ? { accessibilityHint: reason ?? hint } : {})}
      accessibilityState={{
        disabled: off,
        busy,
        ...(selected === undefined ? {} : { selected }),
        ...(checked === undefined ? {} : { checked }),
        ...(expanded === undefined ? {} : { expanded }),
      }}
      accessibilityActions={off ? [] : [{ name: "activate", label }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "activate") activate();
      }}
      android_ripple={header ? undefined : { color: t.color.borderStrong }}
      style={({ pressed }) => [
        ...shape,
        (pressed || hovered) && !off && (filled ? s.activeFilled : s.active),
        focused && s.focused,
        off && s.off,
      ]}
      {...testable(testID)}
    >
      <View style={s.content}>
        {busy && motion === "normal" ? (
          <ActivityIndicator
            size="small"
            color={toneColor(t, textTone)}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          />
        ) : busy ? (
          <Icon name="clock" size="sm" tone={textTone} />
        ) : icon ? (
          <Icon name={icon} size="sm" tone={textTone} />
        ) : null}
        <Text
          role={header ? "body" : "label"}
          weight="semibold"
          tone={textTone}
          style={s.label}
          maxFontSizeMultiplier={0}
        >
          {label}
        </Text>
      </View>
      {reason ? (
        <Text role="label" tone={textTone} align="center" maxFontSizeMultiplier={0}>
          {reason}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    base: {
      minHeight: t.hit,
      justifyContent: "center",
      borderRadius: t.radius.md,
      paddingHorizontal: t.space.lg,
      paddingVertical: t.space.sm,
      borderWidth: t.extent.focus,
      borderColor: t.color.surfacePrimary,
      gap: t.space.xs,
      maxWidth: "100%",
    },
    header: { paddingHorizontal: t.space.sm, borderRadius: 0 },
    primary: { backgroundColor: t.color.accentDefault, borderColor: t.color.accentDefault },
    destructive: { backgroundColor: t.color.statusDanger, borderColor: t.color.statusDanger },
    secondary: {
      borderColor: t.color.borderDefault,
      backgroundColor: t.color.surfacePrimary,
    },
    plain: { paddingHorizontal: t.space.sm, borderColor: t.color.surfaceCanvas },
    content: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: t.space.sm,
    },
    label: { flexShrink: 1, textAlign: "center" },
    focused: {
      borderColor: t.color.focus,
      outlineColor: t.color.focus,
      outlineWidth: t.extent.focus,
      outlineOffset: t.space.xs / 2,
    },
    active: { backgroundColor: t.color.surfaceMuted },
    activeFilled: { borderColor: t.color.accentOn },
    off: {
      borderStyle: "dashed",
      borderColor: t.color.borderStrong,
      backgroundColor: t.color.surfaceMuted,
    },
  });
