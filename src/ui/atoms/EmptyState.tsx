// EmptyState is a list with nothing in it, said plainly, with the one thing
// a person can do about it when there is one.
import React from "react";
import { StyleSheet, View } from "react-native";
import type { Announcement } from "../../core/derive";
import { testable } from "../props";
import { useStyles, type Theme } from "../theme";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import type { Action } from "./Notice";
import { Text } from "./Text";

interface Props {
  readonly icon?: IconName;
  readonly title: string;
  readonly text?: string;
  readonly action?: Action;
  readonly secondary?: Action;
  readonly announcement?: Announcement;
  readonly language?: string;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function EmptyState({
  icon = "empty",
  title,
  text,
  action,
  secondary,
  announcement = "none",
  language,
  accessibilityLabel,
  testID,
}: Props) {
  const s = useStyles(styles);
  return (
    <View style={s.box} {...testable(testID)}>
      <View
        style={s.content}
        accessible
        accessibilityRole="text"
        {...(accessibilityLabel ? { accessibilityLabel } : {})}
        accessibilityLiveRegion={announcement === "urgent" ? "assertive" : announcement}
        {...(language ? { accessibilityLanguage: language } : {})}
      >
        <Icon name={icon} size="lg" tone="muted" />
        <Text role="title" weight="semibold" align="center" maxFontSizeMultiplier={0}>
          {title}
        </Text>
        {text ? (
          <Text tone="muted" align="center" maxFontSizeMultiplier={0}>
            {text}
          </Text>
        ) : null}
      </View>
      {action ? <Button tone="secondary" {...action} /> : null}
      {secondary ? <Button tone="plain" {...secondary} /> : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    box: { alignItems: "center", gap: t.space.md, padding: t.space.xl },
    content: { alignItems: "center", gap: t.space.md, alignSelf: "stretch" },
  });
