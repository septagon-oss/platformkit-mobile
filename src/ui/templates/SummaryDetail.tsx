import React from "react";
import type { DisclosureModel } from "../../core/derive";
import { DisclosureSection } from "../molecules/DisclosureSection";
/** Use a sibling sheet/page for a third level; this layout permits two levels. */
export function SummaryDetail({
  model,
  children,
  onExpanded,
}: {
  readonly model: DisclosureModel;
  readonly children: React.ReactNode;
  readonly onExpanded: (open: boolean) => void;
}) {
  return (
    <DisclosureSection model={model} onExpanded={onExpanded}>
      {children}
    </DisclosureSection>
  );
}
