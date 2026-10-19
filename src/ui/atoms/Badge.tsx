// Badge is a status as a soft pill: one of the four status pairs the palette carries, or neutral.
//
// A pill whose state changed while the person was looking at it — the command they ran moved it —
// changes in place: the pair it wore is laid over the pair it reached and fades out under it, so the
// colour crosses instead of appearing mid-read and the eye stays on the pill it was reading. The word
// itself is swapped, never doubled: a second label in the tree is a second element for a journey to
// find and a second sentence for a reader to be told, and the state a record is in is one fact. A
// preference for less motion, and a screen that names none, get the swap at once — the same tree with
// nothing animating, which is also what every component suite reads.
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import type { Motion } from "../../core/presentation";
import { testable } from "../props";
import { statusPair, useStyles, useTheme, type Theme } from "../theme";
import { Text } from "./Text";
import { Icon } from "./Icon";

export type BadgeTone = "ok" | "warning" | "danger" | "info" | "neutral";

/**
 * pillSettle is how long a pill takes to become the state it reached: long enough for the eye to
 * stay on it, short enough that nobody waits on an animation to read a word. Written once, here.
 */
const pillSettle = 220;

interface Props {
  readonly label: string;
  readonly tone?: BadgeTone;
  readonly symbol?: "none" | "check" | "clock" | "warning";
  /**
   * motion is the person's own preference, handed down from the screen's Feedback and never asked
   * for here. Absent means the still swap: a pill that moved on its own is the first thing a
   * reduced-motion request asks this phone to stop doing.
   */
  readonly motion?: Motion;
  readonly testID?: string;
}

export function Badge({
  label,
  tone = "neutral",
  symbol = "none",
  motion = "reduced",
  testID,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const [fg, bg] = statusPair(t, tone, "muted");
  // The pair this pill wore a moment ago, held only while the colour is on its way from it to the
  // pair now. Nothing else on the screen moves, and a reduced preference holds nothing: the tree
  // swaps at once, which is the same tree with nothing animating.
  const [was, setWas] = useState<{ bg: string } | undefined>(undefined);
  const [shift] = useState(() => new Animated.Value(1));
  const seen = useRef({ tone, label });
  useEffect(() => {
    const before = seen.current;
    seen.current = { tone, label };
    if (motion !== "normal" || (before.tone === tone && before.label === label)) {
      setWas(undefined);
      shift.setValue(1);
      return;
    }
    // The pair is asked for while the previous state is still the pill's own theme, so a theme
    // change underneath a pill that is on its way cannot recolour the colour it is leaving.
    setWas({ bg: statusPair(t, before.tone, "muted")[1] });
    shift.setValue(0);
    // Only opacity moves, which is what the native driver does: the previous pair is a layer over
    // the one the pill reached, and fading that layer out is the colour changing.
    void Animated.timing(shift, {
      toValue: 1,
      duration: pillSettle,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setWas(undefined);
    });
  }, [shift, t, tone, label, motion]);
  return (
    <Animated.View
      style={[s.pill, { backgroundColor: bg }]}
      accessibilityLabel={label}
      {...testable(testID)}
    >
      {was ? (
        // The colour this pill was wearing, drawn over the one it reached and fading out under it.
        // It answers no press and says nothing: the state is one fact, said by the word above it.
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          style={[
            s.pair,
            {
              backgroundColor: was.bg,
              opacity: shift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            },
          ]}
        />
      ) : null}
      {symbol !== "none" ? <Icon name={symbol} size="sm" /> : null}
      <Text role="caption" weight="semibold" style={{ color: fg }}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    // The previous pair, laid over the pill it is leaving: the pill's own corner, no more of the
    // surface than the pill itself.
    pair: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      borderRadius: t.radius.full,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.space.xs,
      alignSelf: "flex-start",
      borderRadius: t.radius.full,
      paddingHorizontal: t.space.sm,
      paddingVertical: t.space.xs / 2,
    },
  });
