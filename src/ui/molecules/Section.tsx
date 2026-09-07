// Section is a group of rows with a name: inset and rounded on iOS the way
// Settings groups are, a raised card on Android the way Material groups are.
// This is the one place the two platforms' chrome differs; a row inside it
// is the same row on both.
import React, { Children, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Text } from "../atoms/Text";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly title?: string;
  readonly footer?: string;
  readonly children: ReactNode;
  readonly testID?: string;
}

export function Section({ title, footer, children, testID }: Props) {
  const s = useStyles(styles);
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={s.section} {...(testID ? { testID } : {})}>
      {title ? (
        <Text role="caption" tone="muted" uppercase style={s.title} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={s.card}>
        {rows.map((row, i) => (
          <View key={i} style={[s.row, i < rows.length - 1 && s.divided]}>
            {row}
          </View>
        ))}
      </View>
      {footer ? (
        <Text role="caption" tone="muted" style={s.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    section: { gap: t.space.xs },
    title: { paddingHorizontal: t.space.lg },
    footer: { paddingHorizontal: t.space.lg },
    card: {
      backgroundColor: t.color.surfacePrimary,
      borderRadius: t.radius.lg,
      overflow: "hidden",
      ...Platform.select({
        android: { elevation: 1 },
        default: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.color.borderDefault,
        },
      }),
    },
    row: { paddingHorizontal: t.space.lg, paddingVertical: t.space.xs },
    divided: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.color.borderDefault,
    },
  });
