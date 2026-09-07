// Skeleton is the shape of what is coming: a few muted lines that breathe
// until the rows arrive, and hold still for a person who asked for less
// motion.
import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly lines?: number;
}

export function Skeleton({ lines = 3 }: Props) {
  const s = useStyles(styles);
  // Created once, and read where it is used rather than during render.
  const [pulse] = useState(() => new Animated.Value(0.5));
  const [still, setStill] = useState(false);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (live) setStill(reduced);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, still]);

  return (
    <View style={s.block} accessible accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: lines }, (_, i) => (
        <Animated.View
          key={i}
          style={[s.line, i === lines - 1 && s.short, { opacity: still ? 0.7 : pulse }]}
        />
      ))}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    block: { gap: t.space.sm, padding: t.space.md },
    line: { height: 14, borderRadius: t.radius.md, backgroundColor: t.color.surfaceMuted },
    short: { width: "60%" },
  });
