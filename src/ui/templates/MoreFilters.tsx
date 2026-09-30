import React from "react";
import type { ChoiceGroupModel } from "../../core/derive";
import { ChoiceChips } from "../molecules/ChoiceChips";
import { DetailSheet } from "./DetailSheet";
import type { DetailSurfaceProps } from "./DetailSurface";
export function MoreFilters({
  filters,
  onChange,
  ...surface
}: DetailSurfaceProps & {
  readonly filters: readonly ChoiceGroupModel[];
  readonly onChange: (groupId: string, choiceId: string | undefined) => void;
}) {
  return (
    <DetailSheet {...surface}>
      {filters.map((filter) => (
        <ChoiceChips key={filter.id} model={filter} onChange={(id) => onChange(filter.id, id)} />
      ))}
    </DetailSheet>
  );
}
