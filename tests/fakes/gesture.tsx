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
  const [open, setOpen] = useState(0);
  // How far the surface stands open, kept beside the state that draws it: a test reads what the
  // last drag decided without waiting for the render that drawing it needs.
  const shown = useRef(0);
  const finger = useRef({ travel: 0, ticked: false });
  const handle: SwipeHandle = {
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
      if (read.armed) onRun();
    },
    open: () => shown.current,
    // The reader's own preference, in the one way a suite can see it: the surface that closes
    // without easing is the surface a reduced-motion request is owed.
    movement: () => (motion === "normal" ? "spring" : "instant"),
  };
  // One handle for the mount, delegating to whatever the surface's latest render decided: the
  // test holds it and never has to re-ask for it between renders.
  const [proxy] = React.useState<SwipeHandle>(() => ({
    drag: (travel) => latest.current.drag(travel),
    release: () => latest.current.release(),
    open: () => latest.current.open(),
    movement: () => latest.current.movement(),
  }));
  const latest = useRef(handle);
  latest.current = handle;
  // Said on every render: the handle is one object for the mount, and a suite that renders a
  // second row into the same root is handed the new row's handle rather than the first one's.
  onReady?.(proxy);
  return (
    <View style={s.hold}>
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
