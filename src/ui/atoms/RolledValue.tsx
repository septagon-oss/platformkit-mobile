// RolledValue is a number that changed while the person was looking at it: the count that moved,
// the money a price edit rewrote, the stat a refresh answered differently. It says so by rolling to
// the new value — the old line sliding out above as the new one slides in below — rather than
// replacing the line the person was reading.
//
// It draws a string somebody else derived and derives none of its own: `commerce.moneyText` and the
// count sentences in `derive` stay the only formatting, and nothing here reads a rendered value
// back into a number. A string of a different length, a change in a position that holds no digit,
// a first draw, or a preference for less motion all answer with the new string at once.
import React, { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { Motion } from "../../core/presentation";
import { testable } from "../props";
import { useStyles, useTheme } from "../theme";
import { Text, type Tone, type Weight } from "./Text";
import type { Role } from "../scale";

/**
 * rollSettle is how long one value takes to become the next: it acknowledges a change that already
 * happened, so it stays well inside the moment a person's eye is still on the line.
 */
const rollSettle = 220;

interface Props {
  /** value is the rendered string this surface already derived — money, a count, a stat. */
  readonly value: string;
  readonly role?: Role;
  readonly tone?: Tone;
  readonly weight?: Weight;
  /** motion is the person's preference, from the screen's Feedback; absent means the still swap. */
  readonly motion?: Motion;
  /** announcement says a change here is worth saying where it stands: a count the person may not
   * be watching when it moves is announced, a figure they are reading is not. */
  readonly announcement?: "none" | "polite";
  readonly testID?: string;
}

export function RolledValue({
  value,
  role = "body",
  tone = "primary",
  weight = "regular",
  motion = "reduced",
  announcement,
  testID,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const [was, setWas] = useState(value);
  const [roll] = useState(() => new Animated.Value(0));
  const line = t.type[role].line;
  // Only equal-length strings whose changed positions all hold a digit can roll: the two lines have
  // to share their columns for the movement to read as one value becoming another.
  const columns =
    was.length === value.length &&
    [...value].every((character, at) => character === was[at] || /\d/.test(character));
  const rolling = motion === "normal" && was !== value && columns;
  useEffect(() => {
    if (was === value) return;
    // What is not rolled is not drawn: the plain string is already on screen, and this only files
    // the old value away. The commit happens when the change is over, at either duration, so no
    // second render is forced while the first is still on screen.
    roll.setValue(0);
    void Animated.timing(roll, {
      toValue: 1,
      duration: rolling ? rollSettle : 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setWas(value);
    });
  }, [was, value, rolling, roll]);
  const live = announcement ?? "none";
  if (!rolling)
    return (
      <Text
        role={role}
        tone={tone}
        weight={weight}
        accessibilityLiveRegion={live}
        {...testable(testID)}
      >
        {value}
      </Text>
    );
  const words = (said: string) => (
    <Text role={role} tone={tone} weight={weight}>
      {said}
    </Text>
  );
  return (
    <View
      accessible
      accessibilityLabel={value}
      accessibilityLiveRegion={live}
      style={[s.surface, { height: line }]}
      {...testable(testID)}
    >
      <Animated.View
        style={[
          s.pair,
          {
            transform: [
              { translateY: roll.interpolate({ inputRange: [0, 1], outputRange: [0, -line] }) },
            ],
          },
        ]}
      >
        {words(was)}
        {words(value)}
      </Animated.View>
    </View>
  );
}

const styles = () =>
  StyleSheet.create({
    // One line of height with the pair inside it: what leaves is clipped, so the roll stays inside
    // the space the value always took and nothing around it moves.
    surface: { overflow: "hidden" },
    pair: { flexDirection: "column" },
  });
