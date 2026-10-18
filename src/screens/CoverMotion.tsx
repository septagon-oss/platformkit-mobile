// CoverMotion is the one file in this app that names react-native-reanimated, and it is
// reached only through the media pack a product supplies to `<Shell>`. The reason is a fact
// about the environment, not a style: importing reanimated evaluates react-native-worklets,
// which throws where no native runtime is loaded — and every screen is loaded by the suite
// that checks it. A product that supplies no motion renderer gets the tree the suite reads.
import React, { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { CoverMotionProps } from "../ui/organisms/RecordCover";
import { extent } from "../ui/scale";

export function CoverMotion({ offset, collapseAt, motion, photo }: CoverMotionProps) {
  const travel = useSharedValue(0);
  useEffect(() => {
    // A person who asked for less motion gets none: the photo holds still and the page moves
    // it exactly as it moves any other line. Otherwise the scroll is smoothed, so a flick
    // settles instead of stepping once per frame the JS thread happened to deliver.
    travel.value =
      motion === "normal" && collapseAt > 0
        ? withTiming(Math.min(Math.max(offset, 0), collapseAt), {
            duration: 220,
            easing: Easing.out(Easing.cubic),
          })
        : 0;
  }, [travel, motion, offset, collapseAt]);
  const style = useAnimatedStyle(() => {
    // The photo lags behind the page by `extent.coverParallax` of the scroll and shrinks to
    // `extent.coverShrink` across the distance it takes to scroll it away. What shows through
    // where it shrinks is the frame's own ink — the ink the caption's gradient dissolves into.
    const at = collapseAt > 0 ? travel.value / collapseAt : 0;
    const shrink = 1 - (1 - extent.coverShrink) * at;
    return {
      transform: [{ translateY: travel.value * (1 - extent.coverParallax) }, { scale: shrink }],
    };
  });
  return <Animated.View style={style}>{photo}</Animated.View>;
}
