import { deriveCopy, deriveFeedback, type Presentation } from "../../src/core/derive";

export const presentation: Presentation = {
  locale: "en-US",
  timeZone: "UTC",
  ownZone: "UTC",
  now: "2026-07-18T09:00:00Z",
  weekStartsOn: 1,
  motion: "reduced",
  copy: deriveCopy("en"),
};
export const feedback = deriveFeedback(presentation.copy, presentation.motion, presentation);
