import React from "react";
import type { SelectionModel } from "../../core/derive";
import { Button } from "./Button";
export function SelectionControl({
  model,
  onChange,
  testID,
}: {
  readonly model: SelectionModel;
  readonly onChange: (selected: boolean) => void;
  readonly testID?: string | undefined;
}) {
  return (
    <Button
      label={model.label}
      tone="secondary"
      accessibilityRole="checkbox"
      checked={model.selected}
      disabled={!model.enabled}
      {...(model.reason ? { reason: model.reason } : {})}
      {...(testID ? { testID } : {})}
      onPress={() => {
        if (model.enabled) onChange(model.target);
      }}
    />
  );
}
