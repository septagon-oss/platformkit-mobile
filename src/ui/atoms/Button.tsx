// Button is the one way an action is offered. A tone says what pressing it
// does to the world; a placement says where it sits, because a button in the
// native header is a word in the accent colour and a button on a page is a
// filled shape, and both are this component.
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { useStyles, useTheme, type Theme } from "../theme";
import { Icon, type IconName } from "./Icon";
import { Text, type Tone as TextTone } from "./Text";

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
  readonly testID?: string;
}

export function Button({
  label,
  onPress,
  tone = "primary",
  placement = "inline",
  icon,
  busy = false,
  disabled = false,
  testID,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const off = disabled || busy;
  const header = placement === "header";
  const filled = !header && (tone === "primary" || tone === "destructive");
  const textTone: TextTone = filled
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
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      android_ripple={header ? undefined : { color: t.color.borderStrong }}
      style={({ pressed }) => [...shape, pressed && s.pressed, off && s.off]}
      {...(testID ? { testID } : {})}
    >
      <View style={s.content}>
        {busy ? (
          <ActivityIndicator
            size="small"
            color={filled ? t.color.accentOn : t.color.accentDefault}
          />
        ) : icon ? (
          <Icon name={icon} size="sm" tone={textTone} />
        ) : null}
        <Text role={header ? "body" : "label"} weight="semibold" tone={textTone}>
          {label}
        </Text>
      </View>
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
      overflow: "hidden",
    },
    header: { paddingHorizontal: t.space.sm, minHeight: 0, borderRadius: 0 },
    primary: { backgroundColor: t.color.accentDefault },
    destructive: { backgroundColor: t.color.statusDanger },
    secondary: {
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.color.borderDefault,
      backgroundColor: t.color.surfacePrimary,
    },
    plain: { paddingHorizontal: t.space.sm },
    content: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: t.space.sm,
    },
    pressed: { opacity: 0.7 },
    off: { opacity: 0.5 },
  });
