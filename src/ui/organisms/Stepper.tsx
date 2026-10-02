import React from "react";
import { View } from "react-native";
import type { StepperModel } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
import { Button } from "../atoms/Button";
import { Notice } from "../atoms/Notice";
import { Text } from "../atoms/Text";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export interface Props {
  readonly model: StepperModel;
  readonly children?: React.ReactNode;
  readonly onNext: () => void;
  readonly onBack: () => void;
  readonly onGo: (id: string) => void;
  readonly onSkip: () => void;
  readonly onFinish: () => void;
  readonly onSaveAndExit: () => void;
  readonly onReconcile: () => void;
}
export function Stepper({
  model,
  children,
  onNext,
  onBack,
  onGo,
  onSkip,
  onFinish,
  onSaveAndExit,
  onReconcile,
}: Props) {
  const s = useStyles(kitStyles);
  return (
    <View style={s.stack}>
      <Text
        accessibilityRole="progressbar"
        accessibilityLabel={model.progressLabel}
        accessibilityValue={{ min: 0, max: 100, now: model.progress * 100 }}
      >
        {model.progressLabel}
      </Text>
      <View style={s.row}>
        {model.steps.map((step) => (
          <Button
            key={step.id}
            label={step.displayLabel}
            tone="secondary"
            selected={step.selected}
            disabled={!step.canGo}
            onPress={() => {
              if (step.canGo) onGo(step.id);
            }}
          />
        ))}
      </View>
      {model.dirty ? <Text>{model.dirty}</Text> : null}
      {model.issue ? <Notice text={model.issue.message} announcement="urgent" /> : null}
      {model.firstProblem ? (
        <Notice text={model.firstProblem.message} announcement="urgent" />
      ) : null}
      {children}
      <View style={s.row}>
        {model.back ? <ActionControl model={model.back} onAction={onBack} /> : null}
        {model.next ? <ActionControl model={model.next} onAction={onNext} /> : null}
        {model.skip ? <ActionControl model={model.skip} onAction={onSkip} /> : null}
        {model.finish ? <ActionControl model={model.finish} onAction={onFinish} /> : null}
        {model.saveAndExit ? (
          <ActionControl model={model.saveAndExit} onAction={onSaveAndExit} />
        ) : null}
        {model.reconcile ? <ActionControl model={model.reconcile} onAction={onReconcile} /> : null}
      </View>
    </View>
  );
}
