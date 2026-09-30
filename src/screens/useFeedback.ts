// A screen adapts native preferences to explicit, pure component inputs.
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import {
  deriveCopy,
  deriveFeedback,
  type Copy,
  type Feedback,
  type Formatting,
  type Motion,
} from "../core/derive";

export function useFeedback(
  copy: Copy = deriveCopy("en"),
  format?: Pick<Formatting, "locale" | "timeZone">,
): Feedback {
  const [motion, setMotion] = useState<Motion>("reduced");
  useEffect(() => {
    let live = true;
    let changed = false;
    const apply = (reduced: boolean) => {
      if (live) setMotion(reduced ? "reduced" : "normal");
    };
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (reduced) => {
      changed = true;
      apply(reduced);
    });
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!changed) apply(reduced);
      })
      .catch(() => undefined);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  const { locale, timeZone } = format ?? Intl.DateTimeFormat().resolvedOptions();
  return deriveFeedback(copy, motion, { locale, timeZone });
}
