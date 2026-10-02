// A model selects existing atoms. Actions report intent to the owning screen.
import React from "react";
import type { StateModel } from "../../core/derive";
import { EmptyState } from "../atoms/EmptyState";
import { Notice, type Action } from "../atoms/Notice";
import { Skeleton } from "../atoms/Skeleton";
import { testable } from "../props";

export interface Props {
  readonly model: StateModel;
  readonly onAction: (id: string) => void;
  readonly testID?: string;
}

export function StateView({ model, onAction, testID }: Props) {
  if (model.component === "skeleton")
    return (
      <Skeleton
        label={model.loadingLabel}
        motion={model.motion}
        variant={model.skeleton}
        {...testable(testID)}
      />
    );
  const actions: Action[] = model.actions.map((action) => ({
    label: action.label,
    tone: action.tone,
    disabled: action.disabled,
    busy: action.busy,
    motion: model.motion,
    ...(action.reason ? { reason: action.reason } : {}),
    ...(action.hint ? { hint: action.hint } : {}),
    ...testable(testID ? `${testID}-action-${encodeURIComponent(action.id)}` : undefined),
    onPress: () => onAction(action.id),
  }));
  const props = {
    title: model.title,
    text: model.body,
    announcement: model.announcement,
    language: model.language,
    accessibilityLabel: model.announcementText,
    icon: model.icon,
    ...(actions[0] ? { action: actions[0] } : {}),
    ...(actions[1] ? { secondary: actions[1] } : {}),
    ...testable(testID),
  };
  return model.component === "empty" ? (
    <EmptyState {...props} />
  ) : (
    <Notice
      {...props}
      tone={model.tone}
      {...(model.updatedAt ? { updatedAt: model.updatedAt } : {})}
    />
  );
}
