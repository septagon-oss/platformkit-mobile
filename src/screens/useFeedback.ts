// A screen adapts native preferences to explicit, pure component inputs.
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import {
  deriveFeedback,
  screenCopy,
  type Clock,
  type Copy,
  type Feedback,
  type Formatting,
  type Motion,
} from "../core/derive";
import { systemClock } from "./clock";

export function useFeedback(
  // The words follow the phone: a Portuguese device reads Portuguese sentences,
  // and every other tag falls back to English. `deriveCopy` stays closed to the
  // two languages this table holds; `copyLanguage` is what reconciles a device's
  // locale tag with them.
  copy: Copy = screenCopy(),
  format?: Pick<Formatting, "locale" | "timeZone">,
  clock: Clock = systemClock,
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
  // The device is asked once, and its zone stays the reader's own even where the
  // caller asks for another zone's clock: a screen that prints the tenant's hours
  // says so, and the phone's own reads as the person lives them.
  const device = Intl.DateTimeFormat().resolvedOptions();
  const { locale, timeZone } = format ?? device;
  return deriveFeedback(copy, motion, {
    locale,
    timeZone,
    ownZone: device.timeZone,
    now: clock.now(),
  });
}
