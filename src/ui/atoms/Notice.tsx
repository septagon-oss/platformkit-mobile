// Notice is something the person needs to read now: a refusal, a lost
// connection, a thing that worked. It announces itself to a screen reader and
// may offer one action, which is how "retry" is offered everywhere.
import React from "react";
import { StyleSheet, View } from "react-native";
import type { Announcement, Motion } from "../../core/derive";
import { testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";
import { Button, type ButtonTone } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export type NoticeTone = "danger" | "warning" | "info" | "ok";

export interface Action {
  readonly label: string;
  readonly onPress: () => void;
  readonly tone?: ButtonTone;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly reason?: string;
  readonly hint?: string;
  readonly motion?: Motion;
  readonly testID?: string;
}

interface Props {
  readonly tone?: NoticeTone;
  readonly title?: string;
  readonly text: string;
  readonly action?: Action;
  readonly secondary?: Action;
  readonly announcement: Announcement;
  readonly updatedAt?: string;
  readonly icon?: IconName;
  readonly language?: string;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

// Retain the old export path; the required copy now comes from the caller.
export { retry } from "../../core/derive";

const icons: Record<NoticeTone, IconName> = {
  danger: "warning",
  warning: "warning",
  info: "server",
  ok: "check",
};

export function Notice({
  tone = "danger",
  title,
  text,
  action,
  secondary,
  announcement,
  updatedAt,
  icon,
  language,
  accessibilityLabel,
  testID,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const fg =
    tone === "danger"
      ? t.color.statusDanger
      : tone === "warning"
        ? t.color.statusWarning
        : tone === "ok"
          ? t.color.statusOk
          : t.color.statusInfo;
  const bg =
    tone === "danger"
      ? t.color.statusDangerBg
      : tone === "warning"
        ? t.color.statusWarningBg
        : tone === "ok"
          ? t.color.statusOkBg
          : t.color.statusInfoBg;
  return (
    <View style={[s.box, { backgroundColor: bg }]} {...testable(testID)}>
      <View
        style={s.row}
        accessible
        {...(accessibilityLabel ? { accessibilityLabel } : {})}
        accessibilityRole={announcement === "urgent" ? "alert" : "text"}
        accessibilityLiveRegion={announcement === "urgent" ? "assertive" : announcement}
        {...(language ? { accessibilityLanguage: language } : {})}
      >
        <Icon
          name={icon ?? icons[tone]}
          size="sm"
          tone={tone === "danger" ? "danger" : "primary"}
        />
        <View style={s.body}>
          {title ? (
            <Text weight="semibold" style={{ color: fg }} maxFontSizeMultiplier={0}>
              {title}
            </Text>
          ) : null}
          <Text style={{ color: fg }} maxFontSizeMultiplier={0}>
            {text}
          </Text>
          {updatedAt ? (
            <Text style={{ color: fg }} maxFontSizeMultiplier={0}>
              {updatedAt}
            </Text>
          ) : null}
        </View>
      </View>
      {action || secondary ? (
        <View style={s.action}>
          {action ? <Button tone="plain" {...action} /> : null}
          {secondary ? <Button tone="plain" {...secondary} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    box: { borderRadius: t.radius.md, padding: t.space.md, gap: t.space.sm },
    row: { flexDirection: "row", gap: t.space.sm, alignItems: "flex-start" },
    body: { flex: 1, gap: t.space.xs },
    action: { flexDirection: "row", flexWrap: "wrap", gap: t.space.sm, justifyContent: "flex-end" },
  });
