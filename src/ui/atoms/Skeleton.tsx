// One loading region. Motion is supplied by the screen, never discovered by an atom.
import React, { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { Motion, SkeletonVariant } from "../../core/derive";
import { testable } from "../props";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly label: string;
  readonly motion: Motion;
  readonly variant?: SkeletonVariant;
  readonly lines?: number;
  readonly testID?: string;
}

export function Skeleton({ label, motion, variant = "lines", lines = 3, testID }: Props) {
  const s = useStyles(styles);
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (motion === "reduced") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [pulse, motion]);

  return (
    <View
      style={s.block}
      accessible
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      aria-busy
      {...testable(testID)}
    >
      <Animated.View
        style={[s.shapes, { opacity: motion === "reduced" ? 1 : pulse }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {variant === "media" ? <View style={s.media} /> : null}
        {Array.from({ length: lines }, (_, index) => (
          <View key={index} style={s.row}>
            {variant === "rows" ? <View style={s.thumbnail} /> : null}
            <View
              style={[s.line, index === lines - 1 && s.short, variant === "detail" && s.detail]}
            />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    block: { padding: t.space.md },
    shapes: { gap: t.space.md },
    row: { flexDirection: "row", alignItems: "center", gap: t.space.md },
    line: {
      flex: 1,
      height: t.extent.skeleton,
      borderRadius: t.radius.md,
      backgroundColor: t.color.surfaceMuted,
    },
    short: { maxWidth: "60%" },
    detail: { marginVertical: t.space.sm },
    thumbnail: {
      width: t.extent.skeletonRow,
      height: t.extent.skeletonRow,
      borderRadius: t.radius.md,
      backgroundColor: t.color.surfaceMuted,
    },
    media: {
      height: t.extent.skeletonMedia,
      borderRadius: t.radius.md,
      backgroundColor: t.color.surfaceMuted,
    },
  });
