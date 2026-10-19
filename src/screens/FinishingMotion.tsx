// FinishingMotion is the drawn half of a record's finishing moment: a checkmark that draws itself
// and a short burst of chips scattering from it, over the record whose state this phone's own write
// reached. It is one more member of the pack a product supplies to `<Shell>`, for the reason
// CoverMotion gives: importing reanimated evaluates react-native-worklets, which throws where no
// native runtime is loaded, and every screen here is loaded by the suite that reads it.
//
// It moves ink and says nothing. The words, the pill and the announcement belong to the record. The
// colour is the tone the arrived state declares, read from the theme's own status pair; the lengths
// are the scale's. A person who asked for less motion, and a product that ships no renderer, never
// see this file's output — and it answers the preference again itself, so a product that composes
// it somewhere else still stops.
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { FinishingProps } from "../ui/organisms/ResourceDetail";
import { statusPair, useStyles, useTheme, type Theme } from "../ui/theme";
import { extent } from "../ui/scale";

/**
 * The moment's two durations, written once, here: the mark draws itself over `markDraw`, the chips
 * fly for `chipsFly` from the same start, and the whole thing is over inside the ceiling the moment
 * promises. Nothing on screen waits for either: the record says its sentence as the mark begins.
 */
const markDraw = 320;
const chipsFly = 900;
/** chips is how many fragments scatter: enough to read as a burst, few enough to stay one gesture. */
const chips = 12;

export function FinishingMotion({ tone, motion, onEnd }: FinishingProps) {
  const t = useTheme();
  const s = useStyles(styles);
  const [fg] = statusPair(t, tone, "muted");
  useEffect(() => {
    if (motion !== "normal") {
      onEnd();
      return;
    }
    // The surface that placed this overlay is the one that stops drawing it, so the burst says
    // plainly when it is over rather than leaving a mark drawn over somebody's record.
    const timer = setTimeout(onEnd, chipsFly);
    return () => clearTimeout(timer);
  }, [motion, onEnd]);
  const away = useSharedValue(0);
  useEffect(() => {
    if (motion !== "normal") return;
    away.value = withTiming(1, { duration: chipsFly, easing: Easing.out(Easing.cubic) });
  }, [away, motion]);
  return (
    <View pointerEvents="none" style={s.burst} testID="record-burst">
      <Chips away={away} colour={fg} reach={extent.burstSpread * extent.cover} />
      <Mark colour={fg} motion={motion} />
    </View>
  );
}

/** Mark is the checkmark: one path, fading and settling into place over `markDraw`. */
function Mark({
  colour,
  motion,
}: {
  readonly colour: string;
  readonly motion: FinishingProps["motion"];
}) {
  const drawn = useSharedValue(motion === "normal" ? 0 : 1);
  useEffect(() => {
    if (motion !== "normal") {
      drawn.value = 1;
      return;
    }
    drawn.value = withTiming(1, { duration: markDraw, easing: Easing.out(Easing.quad) });
  }, [drawn, motion]);
  const style = useAnimatedStyle(() => ({
    opacity: drawn.value,
    transform: [{ scale: 0.6 + 0.4 * drawn.value }],
  }));
  return (
    <Animated.View style={style}>
      <Svg width={extent.mark} height={extent.mark} viewBox="0 0 48 48">
        <Circle cx="24" cy="24" r="22" fill="none" stroke={colour} strokeWidth="2" opacity="0.5" />
        <Path
          d="M13 25 L21 33 L36 16"
          fill="none"
          stroke={colour}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * Chips scatters the arrived state's own colour outwards from the mark. `reach` is how far the
 * outermost fragment travels, a fraction of the surface the burst is drawn over, so the same burst
 * fills a cover and a tile in the same proportion.
 */
function Chips({
  away,
  colour,
  reach,
}: {
  readonly away: SharedValue<number>;
  readonly colour: string;
  readonly reach: number;
}) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {Array.from({ length: chips }, (_, order) => (
        <Chip key={order} away={away} colour={colour} reach={reach} order={order} />
      ))}
    </View>
  );
}

function Chip({
  away,
  colour,
  reach,
  order,
}: {
  readonly away: SharedValue<number>;
  readonly colour: string;
  readonly reach: number;
  readonly order: number;
}) {
  const s = useStyles(styles);
  const style = useAnimatedStyle(() => {
    // Each fragment leaves the mark along its own bearing and fades as it goes, so the burst reads
    // as one event with twelve fragments rather than a pattern sliding across the record.
    const bearing = (order / chips) * Math.PI * 2;
    const distance = (reach * (0.55 + 0.45 * ((order % 3) + 1))) / 3;
    return {
      opacity: 1 - away.value,
      transform: [
        { translateX: Math.cos(bearing) * distance * away.value },
        { translateY: Math.sin(bearing) * distance * away.value },
        { scale: 1 - 0.5 * away.value },
      ],
    };
  });
  return <Animated.View style={[s.chip, { backgroundColor: colour }, s.fragment, style]} />;
}

const styles = (t: Theme) =>
  StyleSheet.create({
    burst: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: t.extent.cover,
      alignItems: "center",
      justifyContent: "center",
    },
    // Every fragment starts at the mark and is moved by its own transform, which is what lets the
    // burst cost no layout: nothing around the record moves while it plays.
    fragment: { position: "absolute" },
    chip: { width: t.extent.confetti, height: t.extent.confetti, borderRadius: t.radius.md },
  });
