// One line illustration from src/core/illustrations.ts, drawn in the theme's two
// ink tokens so the same picture reads on a light page and a dark one. The side
// and the stroke come from the scale and the colours from the palette: a drawing
// carries neither size nor colour of its own. Motion is supplied by the screen,
// never discovered by an atom, and the still state is the default.
import React, { useEffect, useState } from "react";
import { Animated } from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  illustrationCanvas,
  illustrations,
  type IllustrationName,
  type Motion,
} from "../../core/present";
import { testable } from "../props";
import { useTheme } from "../theme";

interface Props {
  readonly name: IllustrationName;
  readonly motion?: Motion;
  readonly testID?: string;
}

export function Illustration({ name, motion = "reduced", testID }: Props) {
  const t = useTheme();
  const [rise] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (motion === "reduced") return;
    const entrance = Animated.timing(rise, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    });
    entrance.start();
    return () => {
      entrance.stop();
      rise.setValue(0);
    };
  }, [rise, motion]);
  // The words a person reads arrive from the labelled View this picture is drawn
  // inside, which is why this element takes no accessibility prop of its own:
  // react-native-svg hands an unknown prop to the DOM node on web, where
  // `accessible` is not an attribute.
  return (
    <Animated.View
      style={motion === "reduced" ? still : rising(rise, t.space.md)}
      {...testable(testID)}
    >
      <Svg
        width={t.extent.illustration}
        height={t.extent.illustration}
        viewBox={`0 0 ${illustrationCanvas} ${illustrationCanvas}`}
      >
        {illustrations[name].parts.map((part) => (
          <Path
            key={part.d}
            d={part.d}
            stroke={part.ink === "detail" ? t.color.accentDefault : t.color.textPrimary}
            strokeWidth={t.extent.illustrationStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>
    </Animated.View>
  );
}

/** still is what a reduced-motion device gets, and the state every entrance ends in. */
const still = { opacity: 1 } as const;

/** rising is the first appearance: the picture fades in as it rises one step of the page's own rhythm. */
const rising = (rise: Animated.Value, distance: number) => ({
  opacity: rise,
  transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
});
