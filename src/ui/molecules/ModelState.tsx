import React from "react";
import type { ContentModel, StateModel } from "../../core/derive";
import { StateView } from "./StateView";
export function ModelState({
  model,
  onRetry,
  onAction,
}: {
  readonly model: ContentModel;
  readonly onRetry?: () => void;
  readonly onAction?: (id: string) => void;
}) {
  const activate = (state: StateModel, id: string) => {
    if (onAction) onAction(id);
    else if (state.actions.some((action) => action.id === id && action.intent === "retry-read"))
      onRetry?.();
  };
  return (
    <>
      {model.state ? (
        <StateView model={model.state} onAction={(id) => activate(model.state!, id)} />
      ) : null}
      {model.notice ? (
        <StateView model={model.notice} onAction={(id) => activate(model.notice!, id)} />
      ) : null}
    </>
  );
}
