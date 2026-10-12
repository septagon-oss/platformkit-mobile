import React from "react";
import type { DisclosureModel } from "../../core/derive";
import { DisclosureSection } from "../molecules/DisclosureSection";
/** Use a sibling sheet/page for a third level; this layout permits two levels. */
export function SummaryDetail({
  model,
  children,
  onExpanded,
  testID,
}: {
  readonly model: DisclosureModel;
  readonly children: React.ReactNode;
  readonly onExpanded: (open: boolean) => void;
  /** testID names the control that opens the section, so a journey finds it by what it opens. */
  readonly testID?: string;
}) {
  return (
    <DisclosureSection model={model} onExpanded={onExpanded} {...(testID ? { testID } : {})}>
      {children}
    </DisclosureSection>
  );
}
