import React, { useLayoutEffect, useRef } from "react";
import type { ActionModel as Control } from "../../core/derive";
import { Button } from "./Button";
export function ActionControl({
  model,
  onAction,
  testID,
}: {
  readonly model: Control;
  readonly onAction?: (id: string) => void;
  readonly testID?: string | undefined;
}) {
  const current = useRef({ model, onAction });
  useLayoutEffect(() => {
    current.current = { model, onAction };
  }, [model, onAction]);
  return (
    <Button
      label={model.label}
      tone={model.tone}
      disabled={!model.enabled}
      busy={model.busy}
      {...(model.reason ? { reason: model.reason } : {})}
      {...(model.hint ? { hint: model.hint } : {})}
      {...(testID ? { testID } : {})}
      onPress={() => {
        const value = current.current;
        if (value.model.enabled) value.onAction?.(value.model.id);
      }}
    />
  );
}
