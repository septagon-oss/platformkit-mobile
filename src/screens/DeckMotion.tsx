import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { readDeckDrag } from "../core/gesture";
import type { DeckMotionProps } from "../ui/organisms/ResourceDeck";
import { space } from "../ui/scale";

const duration = 220;

/** DeckMotion moves the supplied surface and bridges armed releases; all choice guards remain in core. */
export function DeckMotion({
  children,
  overlays,
  available,
  motion,
  transition,
  operation,
  onChoose,
  onSettled,
}: DeckMotionProps) {
  const x = useSharedValue(0),
    y = useSharedValue(0),
    opacity = useSharedValue(1);
  const width = useSharedValue(0),
    height = useSharedValue(0),
    geometry = useSharedValue(0);
  const captured = useSharedValue({ width: 0, height: 0, geometry: 0 });
  const valid = useSharedValue(false),
    ticked = useSharedValue(false);
  const reduced = motion !== "normal";
  const read = useDerivedValue(() =>
    readDeckDrag(x.get(), y.get(), width.get(), height.get(), available, reduced),
  );
  const tick = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };
  useEffect(() => {
    valid.set(false);
    cancelAnimation(x);
    cancelAnimation(y);
    cancelAnimation(opacity);
    x.set(0);
    y.set(0);
    opacity.set(1);
    if (!transition) return;
    let ended = false;
    const end = () => {
      if (!ended) {
        ended = true;
        onSettled();
      }
    };
    const dx = transition.direction === "left" ? -1 : transition.direction === "right" ? 1 : 0;
    const dy = transition.direction === "up" ? -1 : transition.direction === "down" ? 1 : 0;
    if (transition.kind === "refusal") {
      x.set(withSpring(0));
      y.set(withSpring(0));
      opacity.set(
        withTiming(1, { duration: reduced ? 0 : duration }, (finished) => {
          if (finished) scheduleOnRN(end);
        }),
      );
    } else if (reduced) {
      opacity.set(transition.kind === "rewind" ? 0 : 1);
      opacity.set(
        withTiming(transition.kind === "rewind" ? 1 : 0, { duration }, (finished) => {
          if (finished) scheduleOnRN(end);
        }),
      );
    } else {
      if (transition.kind === "rewind") {
        x.set(dx * width.get() * 1.5);
        y.set(dy * height.get() * 1.5);
      }
      x.set(withTiming(transition.kind === "rewind" ? 0 : dx * width.get() * 1.5, { duration }));
      y.set(withTiming(transition.kind === "rewind" ? 0 : dy * height.get() * 1.5, { duration }));
      opacity.set(
        withTiming(transition.kind === "rewind" ? 1 : 0, { duration }, (finished) => {
          if (finished) scheduleOnRN(end);
        }),
      );
    }
    return () => {
      cancelAnimation(x);
      cancelAnimation(y);
      cancelAnimation(opacity);
      end();
    };
  }, [operation, transition, motion, reduced, onSettled, valid, x, y, opacity, width, height]);
  const gesture = Gesture.Pan()
    .enabled(available.length > 0 && !transition)
    .maxPointers(1)
    .onTouchesDown((event, manager) => {
      if (event.numberOfTouches > 1) {
        valid.set(false);
        manager.fail();
      }
    })
    .onBegin(() => {
      captured.set({ width: width.get(), height: height.get(), geometry: geometry.get() });
      valid.set(width.get() > 0 && height.get() > 0);
      x.set(0);
      y.set(0);
      ticked.set(false);
    })
    .onUpdate((event) => {
      if (event.numberOfPointers !== 1 || captured.get().geometry !== geometry.get())
        valid.set(false);
      if (!valid.get()) return;
      x.set(event.translationX);
      y.set(event.translationY);
      const result = readDeckDrag(
        event.translationX,
        event.translationY,
        captured.get().width,
        captured.get().height,
        available,
        reduced,
      );
      if (result.armed && !ticked.get()) {
        ticked.set(true);
        scheduleOnRN(tick);
      }
    })
    .onEnd((event, released) => {
      const result = readDeckDrag(
        event.translationX,
        event.translationY,
        captured.get().width,
        captured.get().height,
        available,
        reduced,
      );
      const choose =
        released &&
        valid.get() &&
        event.numberOfPointers <= 1 &&
        captured.get().geometry === geometry.get() &&
        result.armed;
      valid.set(false);
      if (choose && result.direction) scheduleOnRN(onChoose, result.direction, operation);
      x.set(withSpring(0));
      y.set(withSpring(0));
    })
    .onFinalize(() => {
      valid.set(false);
      x.set(withSpring(0));
      y.set(withSpring(0));
    });
  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: reduced
      ? []
      : [{ translateX: x.get() }, { translateY: y.get() }, { rotate: `${read.get().tilt}deg` }],
  }));
  return (
    <View
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        if (width.get() !== next.width || height.get() !== next.height) {
          geometry.set(geometry.get() + 1);
          valid.set(false);
        }
        width.set(next.width);
        height.set(next.height);
      }}
      testID="deck-surface"
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={style}>
          {children}
          {overlays.map((overlay) => (
            <Overlay key={overlay.direction} direction={overlay.direction} reading={read}>
              {overlay.content}
            </Overlay>
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function Overlay({
  direction,
  reading,
  children,
}: {
  readonly direction: string;
  readonly reading: { get(): ReturnType<typeof readDeckDrag> };
  readonly children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: reading.get().direction === direction ? reading.get().opacity : 0,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, style]}
    >
      {children}
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: space.lg,
    left: space.lg,
    right: space.lg,
    alignItems: "center",
  },
});
