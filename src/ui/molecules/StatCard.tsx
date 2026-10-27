// StatCard is one count a person may open: the number, the word it counts, the
// sub-count beside it, and the fortnight's shape under them. Props in, elements out: the
// join that produced these values is the caller's, not this molecule's.
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import type { SparklineModel, StatModel } from "../../core/charts";
import { Text } from "../atoms/Text";
import { testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";
import { Sparkline } from "./Sparkline";
import { StatTile } from "./StatTile";

export interface Props {
  readonly stat: StatModel;
  /** secondary is the sub-count in the catalogue's own word: "Due today · 4". */
  readonly secondary?: string;
  readonly spark?: SparklineModel;
  /** aloud is the card's whole sentence, which is what the shape below is decoration for. */
  readonly aloud: string;
  readonly onPress: () => void;
  readonly testID?: string;
}

export function StatCard({ stat, secondary, spark, aloud, onPress, testID }: Props) {
  const s = useStyles(styles);
  const t = useTheme();
  return (
    <Pressable
      style={s.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={aloud}
      android_ripple={{ color: t.color.borderDefault }}
      {...testable(testID)}
    >
      <StatTile model={stat} framed={false} />
      {secondary === undefined ? null : (
        <Text role="caption" tone="muted" numberOfLines={1}>
          {secondary}
        </Text>
      )}
      {spark === undefined ? null : (
        <Sparkline model={spark} height={t.extent.sparkline} decorative />
      )}
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    // The two extents are the card's own: `statCard` is the narrowest a card may be
    // squeezed to, which is what makes a row of them wrap onto a second line rather than
    // crush a number, and `statBand` the least it stands tall. A number that wrapped to
    // two lines would stop being the thing you came for.
    card: {
      flex: 1,
      minWidth: t.extent.statCard,
      minHeight: t.extent.statBand,
      gap: t.space.xs,
      padding: t.space.md,
      backgroundColor: t.color.surfacePrimary,
      borderColor: t.color.borderDefault,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: t.radius.lg,
    },
  });
