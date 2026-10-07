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
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={model.progress * 100}
      >
        {model.progressText}
      </Text>
      <View style={s.row}>
        {model.steps.map((step) => (
          // A stage is named by the thing it asks for; its state is drawn, not
          // appended to its name. The stage a person is standing on carries the
          // ring the kit uses for what is chosen, a stage they finished carries
          // the check that says so, and a stage this task will not let them jump
          // to keeps the outline that means exactly that — which is not the one
          // they are on. The full words, "Your details · Complete", are what the
          // control announces, in the language the screen was asked for.
          <Button
            key={step.id}
            label={step.label}
            name={step.displayLabel}
            tone="secondary"
            {...(step.completion === "complete" ? { icon: "check" as const } : {})}
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
      {/* Moving the stage on and leaving it are different acts, so they are not
          offered in one line: what the stage asks for now stands on its own, and
          going back, saving the draft or resolving a lost write follow beneath. */}
      <View style={s.row} testID="stepper-verbs">
        {model.next ? <ActionControl model={model.next} onAction={onNext} /> : null}
        {model.finish ? <ActionControl model={model.finish} onAction={onFinish} /> : null}
        {model.skip ? <ActionControl model={model.skip} onAction={onSkip} /> : null}
      </View>
      <View style={s.row} testID="stepper-exit">
        {model.back ? <ActionControl model={model.back} onAction={onBack} /> : null}
        {model.saveAndExit ? (
          <ActionControl model={model.saveAndExit} onAction={onSaveAndExit} />
        ) : null}
        {model.reconcile ? <ActionControl model={model.reconcile} onAction={onReconcile} /> : null}
      </View>
    </View>
  );
}
