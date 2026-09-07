// Notice is something the person needs to read now: a refusal, a lost
// connection, a thing that worked. It announces itself to a screen reader and
// may offer one action, which is how "retry" is offered everywhere.
import React from "react";
import { StyleSheet, View } from "react-native";
import { useStyles, useTheme, type Theme } from "../theme";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export type NoticeTone = "danger" | "warning" | "info" | "ok";

interface Props {
  readonly tone?: NoticeTone;
  readonly title?: string;
  readonly text: string;
  readonly action?: { readonly label: string; readonly onPress: () => void };
  readonly testID?: string;
}

const icons: Record<NoticeTone, IconName> = {
  danger: "warning",
  warning: "warning",
  info: "server",
  ok: "check",
};

export function Notice({ tone = "danger", title, text, action, testID }: Props) {
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
    <View style={[s.box, { backgroundColor: bg }]} {...(testID ? { testID } : {})}>
      <View style={s.row} accessible accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Icon name={icons[tone]} size="sm" tone={tone === "danger" ? "danger" : "primary"} />
        <View style={s.body}>
          {title ? (
            <Text role="label" weight="semibold" style={{ color: fg }}>
              {title}
            </Text>
          ) : null}
          <Text role="label" style={{ color: fg }}>
            {text}
          </Text>
        </View>
      </View>
      {action ? (
        <View style={s.action}>
          <Button label={action.label} onPress={action.onPress} tone="plain" />
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
    action: { alignItems: "flex-end" },
  });
