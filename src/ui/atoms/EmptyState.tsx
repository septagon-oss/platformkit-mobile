// EmptyState is a list with nothing in it, said plainly, with the one thing
// a person can do about it when there is one. It is drawn, not blank: the
// picture above the words is the entry's own icon, or the magnifier when a
// filter is what left the list empty.
import React from "react";
import { StyleSheet, View } from "react-native";
import type { Announcement, IllustrationName, Motion } from "../../core/derive";
import { testable } from "../props";
import { useStyles, type Theme } from "../theme";
import { Button } from "./Button";
import { Illustration } from "./Illustration";
import type { Action } from "./Notice";
import { Text } from "./Text";

interface Props {
  readonly illustration?: IllustrationName;
  readonly motion?: Motion;
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
  illustration = "empty",
  motion = "reduced",
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
        <Illustration name={illustration} motion={motion} />
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
