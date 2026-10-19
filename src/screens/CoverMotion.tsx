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

/** flight is how long a tapped picture takes to become the record's cover. */
const flight = 260;

export function CoverMotion({ offset, collapseAt, motion, photo, from }: CoverMotionProps) {
  const travel = useSharedValue(0);
  // The flight is one shot: it plays from the frame the pressed row's picture held to the cover
  // this page draws, and it is over. A record that did not come from a measured press has no
  // frame, `arrived` stays 1, and the photo is simply where the page put it.
  const arrived = useSharedValue(from === undefined || motion !== "normal" ? 1 : 0);
  useEffect(() => {
    if (from === undefined || motion !== "normal") {
      arrived.value = 1;
      return;
    }
    arrived.value = withTiming(1, { duration: flight, easing: Easing.out(Easing.cubic) });
  }, [arrived, from, motion]);
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
  // How big the picture was where it was tapped, against how big the cover draws it: the flight
  // begins at that proportion and ends at one. A cover is as wide as the page and `extent.cover`
  // tall, so a thumbnail's height is the only measurement the start needs.
  const begin = from === undefined ? 1 : Math.min(1, from.height / extent.cover);
  const style = useAnimatedStyle(() => {
    // The photo lags behind the page by `extent.coverParallax` of the scroll and shrinks to
    // `extent.coverShrink` across the distance it takes to scroll it away. What shows through
    // where it shrinks is the frame's own ink — the ink the caption's gradient dissolves into.
    const at = collapseAt > 0 ? travel.value / collapseAt : 0;
    const shrink = 1 - (1 - extent.coverShrink) * at;
    // `arrived` is 1 for every open that came from nowhere, so the two terms below are 0 and this
    // is exactly the still cover: nothing about a record that did not fly in is drawn differently.
    const grown = arrived.value;
    return {
      opacity: arrived.value,
      transform: [
        { translateY: travel.value * (1 - extent.coverParallax) + (1 - grown) * (from?.y ?? 0) },
        { scale: shrink * (begin + (1 - begin) * grown) },
      ],
    };
  });
  return <Animated.View style={style}>{photo}</Animated.View>;
}
