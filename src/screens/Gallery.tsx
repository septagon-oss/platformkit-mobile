// The reference gallery samples its clock and native preferences at composition.
import React from "react";
import { deriveCopy, type Clock, type Presentation } from "../core/derive";
import { Gallery as GalleryView } from "../ui/gallery";
import { screenCopy } from "./failure";
import { useFeedback } from "./useFeedback";
import { StateFeedback } from "./StateFeedback";
import type { Props as StateViewProps } from "../ui/molecules/StateView";
import { NativeZoom } from "./NativeZoom";
import { systemClock } from "./clock";

const stateFeedback = (props: StateViewProps) => <StateFeedback {...props} />;

export function Gallery({
  clock = systemClock,
  page,
  initialCaseId,
}: {
  readonly clock?: Clock;
  /** page shows one screen-shaped composition; the index screen keeps the pickers. */
  readonly page?: string;
  /** initialCaseId opens the index screen on one specimen, so a specimen can be pointed at, photographed and linked. */
  readonly initialCaseId?: string;
}) {
  const feedback = useFeedback();
  const { locale, timeZone } = Intl.DateTimeFormat().resolvedOptions();
  const presentation: Presentation = {
    locale,
    timeZone,
    ownZone: timeZone,
    now: clock.now(),
    weekStartsOn: 1,
    // The gallery starts in the phone's language; the person's own choice in the
    // appearance row still overrides it.
    copy: screenCopy(),
    motion: feedback.motion,
  };
  return (
    <GalleryView
      presentation={presentation}
      {...(page === undefined ? {} : { page })}
      {...(initialCaseId === undefined ? {} : { initialCaseId })}
      renderState={stateFeedback}
      renderZoom={(props) => <NativeZoom {...props} />}
    />
  );
}
