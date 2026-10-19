// RowSwipe is the surface a row's command stands open under: a drag from the trailing edge uncovers
// it, the row moves with the finger, and a release at or past the width of what the person uncovered
// runs the command the list named. It arrives by the product's renderer pack because the drag is
// react-native-gesture-handler and the ink is react-native-reanimated, and importing either
// evaluates react-native-worklets, which throws wherever no native runtime is loaded — the same
// reason src/renderers.ts exists.
//
// It moves ink and says nothing. The word, the tone and the decision of what a release means come
// from the caller, and the reading of the drag is `readSwipe`, the same one a test drives a fake
// surface with: what a person sees is exactly what the phone requires, so a surface drawn open and
// a command that will run are one sight and no second threshold lives here.
import React from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { readSwipe } from "../core/gesture";
import type { RowActionProps } from "../ui/organisms/DataList";
import { Icon } from "../ui/atoms/Icon";
import { Text } from "../ui/atoms/Text";
import { swipe } from "../ui/scale";
import { useStyles, type Theme } from "../ui/theme";

/**
 * settle is how long the surface takes to close again: a moment, not a wait. A reader who asked
 * for less motion is answered by this number going to nothing — the surface still tracks the
 * finger, which is the person's own movement rather than an animation, and the tick and the run
 * are unchanged.
 */
const settle = 180;

export function RowSwipe({ action, motion, onRun, children }: RowActionProps) {
  const s = useStyles(styles);
  const duration = motion === "normal" ? settle : 0;
  // How far the finger travelled toward the trailing edge, and how much of the surface stands
  // open. Both are shared values: the finger writes them on the UI thread and nothing renders
  // between one position and the next.
  const travel = useSharedValue(0);
  const open = useSharedValue(0);
  // Felt once per drag, at the crossing. The flag lives on the UI thread because the crossing is
  // noticed there.
  const ticked = useSharedValue(false);
  const tick = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const felt = runOnJS(tick);
  const act = runOnJS(onRun);
  const gesture = Gesture.Pan()
    .maxPointers(1)
    // A horizontal drag becomes the row's once it has moved the page's own gap, and stops being
    // one the moment it turns into a scroll: the list keeps the vertical, the row keeps the swipe.
    .activeOffsetX([-swipe.armX, swipe.armX])
    .failOffsetY([-swipe.failY, swipe.failY])
    .onBegin(() => {
      ticked.value = false;
    })
    .onUpdate((event) => {
      // A drag toward the trailing edge is what uncovers the surface, so the reading is how far
      // the finger went that way and nothing else: a drag back across the row reads as closed.
      const read = readSwipe(-event.translationX, swipe.reveal);
      travel.value = -event.translationX;
      open.value = read.open;
      // A tick per frame would be a metronome, and a tick on release would be the success tick the
      // run itself already fires. This one says "this is the act", not "it is done", and it asks
      // nothing of the motion preference: less motion is a request about ink, not about touch.
      if (read.armed && !ticked.value) {
        ticked.value = true;
        felt();
      }
    })
    .onEnd(() => {
      // The surface closes whichever way the decision goes: a command that runs leaves no open row
      // behind it, and one that must be asked first stays a question the row keeps over it.
      open.value = withTiming(0, { duration });
      if (readSwipe(travel.value, swipe.reveal).armed) act();
    })
    // A drag the list took back instead never reaches onEnd, and the surface has to go home anyway.
    .onFinalize(() => {
      open.value = withTiming(0, { duration });
    });
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: -open.value }] }));
  const surface = useAnimatedStyle(() => ({ width: open.value }));
  return (
    // `row-reveal` is the holder a journey finds a swipeable row by; the layer under the row keeps
    // the command's own verb, which is what a flow says the row is for.
    <View style={s.hold} testID="row-reveal">
      {/* The command, under the row. It answers no press — a tap can only land on the row it sits
          beneath — and says nothing to a reader, who is offered the same command as a named action
          of the row instead. */}
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[s.surface, action.destructive ? s.hurt : s.act, surface]}
        testID={`command-${action.verb}`}
      >
        {action.icon ? <Icon name={action.icon} size="sm" tone="on" /> : null}
        <Text role="caption" weight="semibold" tone="on" numberOfLines={2}>
          {action.label}
        </Text>
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={row}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    hold: { overflow: "hidden" },
    surface: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: t.space.xs,
      paddingHorizontal: t.space.sm,
      overflow: "hidden",
    },
    // The two pairs a command may be revealed in are the two a control may be pressed in: the
    // accent for the act, the danger for the one that hurts. Both are certified under `on` ink.
    act: { backgroundColor: t.color.accentDefault },
    hurt: { backgroundColor: t.color.statusDanger },
  });
