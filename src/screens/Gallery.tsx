// The reference gallery samples its clock and native preferences at composition.
import React from "react";
import { deriveCopy, type Clock, type Presentation } from "../core/derive";
import { Gallery as GalleryView } from "../ui/gallery";
import { useFeedback } from "./useFeedback";
import { StateFeedback } from "./StateFeedback";
import type { Props as StateViewProps } from "../ui/molecules/StateView";
import { NativeZoom } from "./NativeZoom";
import { systemClock } from "./clock";

const stateFeedback = (props: StateViewProps) => <StateFeedback {...props} />;

export function Gallery({
  clock = systemClock,
  page,
}: {
  readonly clock?: Clock;
  /** page shows one screen-shaped composition; the index screen keeps the pickers. */
  readonly page?: string;
}) {
  const feedback = useFeedback();
  const { locale, timeZone } = Intl.DateTimeFormat().resolvedOptions();
  const presentation: Presentation = {
    locale,
    timeZone,
    now: clock.now(),
    weekStartsOn: 1,
    copy: deriveCopy("en"),
    motion: feedback.motion,
  };
  return (
    <GalleryView
      presentation={presentation}
      {...(page === undefined ? {} : { page })}
      renderState={stateFeedback}
      renderZoom={(props) => <NativeZoom {...props} />}
    />
  );
}
