// ProgressMeter is how much is left, said with the number beside it. Spinner
// says something is happening; a meter says how far through it is, and refuses
// to draw a bar when no denominator exists to measure against — an invented
// percentage is worse than none.
import React from "react";
import { StyleSheet, View } from "react-native";
import type { MeterModel } from "../../core/progress";
import { testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";
import { Notice } from "../atoms/Notice";
import { Text } from "../atoms/Text";

interface Props {
  readonly model: MeterModel;
  /** tone colours the filled part: a track, a queue and a session differ without differing in shape. */
  readonly tone?: "accent" | "ok" | "warning";
  /** marks is the rail a stepper draws: the same fraction, cut into whole steps. */
  readonly marks?: boolean;
  readonly testID?: string;
}

export function ProgressMeter({ model, tone = "accent", marks = false, testID }: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  if (model.kind === "indeterminate") {
    return (
      <View {...testable(testID)}>
        <View style={s.head}>
          <Text role="label">{model.label}</Text>
          <Text role="numeric" tone="muted">
            {model.text}
          </Text>
        </View>
        <Notice
          tone="info"
          text={model.reason ?? ""}
          announcement="polite"
          icon="clock"
          {...testable(testID ? `${testID}-unmeasured` : undefined)}
        />
      </View>
    );
  }
  const fill =
    tone === "ok"
      ? t.color.statusOk
      : tone === "warning"
        ? t.color.statusWarning
        : t.color.accentDefault;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={model.label}
      accessibilityValue={{ min: 0, max: model.max, now: model.value, text: model.text }}
      {...testable(testID)}
    >
      <View style={s.head}>
        <Text role="label">{model.label}</Text>
        <Text role="numeric" tone="muted">
          {model.text}
        </Text>
      </View>
      <View style={s.track} accessibilityElementsHidden>
        {marks ? (
          <View style={s.marks}>
            {Array.from({ length: model.max }, (_, i) => (
              <View
                key={i}
                style={[
                  s.mark,
                  i < model.value
                    ? { backgroundColor: fill, opacity: 1 }
                    : { backgroundColor: t.color.borderDefault },
                ]}
              />
            ))}
          </View>
        ) : (
          <View style={[s.bar, { backgroundColor: t.color.surfaceMuted }]}>
            <View
              style={[
                s.fill,
                {
                  backgroundColor: fill,
                  width: `${Math.round((model.fraction ?? 0) * 1000) / 10}%`,
                },
              ]}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    head: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: t.space.sm,
    },
    track: { paddingTop: t.space.xs },
    bar: { height: t.extent.meter, borderRadius: t.radius.full, overflow: "hidden" },
    fill: { height: "100%", borderRadius: t.radius.full },
    marks: { flexDirection: "row", gap: t.space.xs, height: t.extent.meter },
    mark: { flex: 1, borderRadius: t.radius.full },
  });
