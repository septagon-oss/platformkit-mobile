// The swipe without a finger. It is the surface a component suite mounts in place of the product's
// reanimated one, and it decides everything the real one decides with the same `readSwipe` and the
// same `swipe` lengths: a case that passes here passes on a device for the same reason, and a
// threshold that moves in src/ui/scale.ts moves both. It is driven by drag distances, never by a
// flag that says "pretend it is armed".
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { readSwipe } from "../../src/core/gesture";
import type { RowActionProps } from "../../src/ui/organisms/DataList";
import { swipe } from "../../src/ui/scale";
import { Text } from "../../src/ui/atoms/Text";
import { useStyles, type Theme } from "../../src/ui/theme";

/** SwipeHandle is how a test moves a row: the finger's distance, then the release. */
export interface SwipeHandle {
  /** drag moves the row `travel` points toward the trailing edge, negative for back across it. */
  drag(travel: number): void;
  /** release lifts the finger, which is the moment of decision — never a crossing under it. */
  release(): void;
  /** open is how much of the surface the last drag left uncovered. */
  open(): number;
  /** movement names what the surface did with the ink: a spring, or nothing at all. */
  movement(): "spring" | "instant";
}

export interface Props extends RowActionProps {
  /** onReady is handed the handle this surface answers, once, when it first draws. */
  onReady?: (handle: SwipeHandle) => void;
}

export function RowSwipe({ action, motion, onRun, children, onReady }: Props) {
  const s = useStyles(styles);
  const [open, setOpen] = React.useState(0);
  // How far the surface stands open, kept beside the state that draws it: a test reads what the
  // last drag decided without waiting for the render that drawing it needs.
  const shown = React.useRef(0);
  const finger = React.useRef({ travel: 0, ticked: false });
  // The two facts a render can change under a drag that is already in progress. They end in
  // `Ref` and are written from an effect, because a render never reads a ref: the moment of
  // decision is a release, which happens after every render that led to it.
  const onRunRef = React.useRef(onRun);
  const motionRef = React.useRef(motion);
  React.useEffect(() => {
    onRunRef.current = onRun;
    motionRef.current = motion;
  });
  // One handle for the mount, so a test never has to re-ask for it between renders. Everything it
  // reads is a ref or the one pure reading both surfaces share, so it decides as the surface
  // standing in front of it decides — including for a row rendered later in its place.
  const [proxy] = React.useState<SwipeHandle>(() => ({
    drag: (travel) => {
      const read = readSwipe(travel, swipe.reveal);
      finger.current.travel = travel;
      shown.current = read.open;
      if (read.armed && !finger.current.ticked) {
        finger.current.ticked = true;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setOpen(read.open);
    },
    release: () => {
      const read = readSwipe(finger.current.travel, swipe.reveal);
      finger.current = { travel: 0, ticked: false };
      shown.current = 0;
      setOpen(0);
      // Release is the moment of decision: nothing before it acts, and a short drag says nothing.
      if (read.armed) onRunRef.current();
    },
    open: () => shown.current,
    // The reader's own preference, in the one way a suite can see it: the surface that closes
    // without easing is the surface a reduced-motion request is owed.
    movement: () => (motionRef.current === "normal" ? "spring" : "instant"),
  }));
  // Said on every render: the handle is one object for the mount, and a suite that renders a
  // second row into the same root is handed the new row's handle rather than the first one's.
  onReady?.(proxy);
  return (
    // The holder answers to the id the product's surface gives it; the layer under the row keeps
    // the command's own verb, which a reader is told past rather than shown, and so answers no query.
    <View style={s.hold} testID="row-reveal">
      {/* The command the way the product's surface draws it: the word, in the pair the command
          deserves, uncovered by exactly the distance the finger travelled. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[s.surface, action.destructive ? s.hurt : s.act, { width: open }]}
        testID={`command-${action.verb}`}
      >
        <Text role="caption" weight="semibold" tone="on" numberOfLines={2}>
          {action.label}
        </Text>
      </View>
      <View style={{ transform: [{ translateX: -open }] }}>{children}</View>
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
      alignItems: "center",
      justifyContent: "center",
      gap: t.space.xs,
      paddingHorizontal: t.space.sm,
      overflow: "hidden",
    },
    act: { backgroundColor: t.color.accentDefault },
    hurt: { backgroundColor: t.color.statusDanger },
  });
