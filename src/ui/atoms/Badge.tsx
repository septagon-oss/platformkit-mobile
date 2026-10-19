// Badge is a status as a soft pill: one of the four status pairs the palette carries, or neutral.
//
// A pill whose state changed while the person was looking at it — the command they ran moved it —
// changes in place: it is drawn up from nothing in the same space over a few hundred milliseconds,
// so the eye stays on the pill it was reading instead of being handed a different one. A preference
// for less motion, and a screen that names none, get the swap at once: the same tree with nothing
// animating, which is also what every component suite reads.
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
  // The pill's own arrival: when the state it carries moves, the words and the colour are drawn
  // up from nothing over the same space, so the eye stays on the pill it was reading instead of
  // being handed a new one. Nothing else on the screen moves, and a reduced preference runs none
  // of it — the tree swaps at once, which is the same tree with nothing animating.
  const [arrival] = useState(() => new Animated.Value(1));
  const seen = useRef({ tone, label });
  useEffect(() => {
    const before = seen.current;
    seen.current = { tone, label };
    if (motion !== "normal" || (before.tone === tone && before.label === label)) return;
    arrival.setValue(0);
    void Animated.timing(arrival, {
      toValue: 1,
      duration: pillSettle,
      useNativeDriver: true,
    }).start();
  }, [arrival, tone, label, motion]);
  return (
    <Animated.View
      style={[s.pill, { backgroundColor: bg, opacity: arrival }]}
      accessibilityLabel={label}
      {...testable(testID)}
    >
      {symbol !== "none" ? <Icon name={symbol} size="sm" /> : null}
      <Text role="caption" weight="semibold" style={{ color: fg }}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
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
