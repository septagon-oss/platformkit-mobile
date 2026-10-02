// Screens sample time, then give the UI an explicit value. No shared mutable clock.
import { useState } from "react";
import { instantValue, type Clock } from "../core/derive";

export const systemClock: Clock = { now: () => new Date().toISOString() };

/** A form's initial date stays stable while its fields change. */
export function useInitialDate(clock: Clock): Date {
  const [initial] = useState(() => {
    const value = instantValue(clock.now());
    if (!value) throw new RangeError("invalid-input: clock.now");
    return value;
  });
  return initial;
}
