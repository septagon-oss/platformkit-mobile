// A step write with an unknown outcome keeps what the person typed and offers reconciliation
// only: no second submit, no advance, no discarded draft.
import React, { useState } from "react";
import { View } from "react-native";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { deriveCopy, deriveStepper, type StepperInput } from "../../src/core/derive";
import { TextField } from "../../src/ui/atoms/TextField";
import { Stepper } from "../../src/ui/organisms/Stepper";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

function DraftField() {
  const [value, setValue] = useState("");
  return (
    <TextField
      testID="step-draft-input"
      accessibilityLabel="Draft"
      value={value}
      onChangeText={setValue}
    />
  );
}

test.each([
  { language: "en", mode: "light" },
  { language: "en", mode: "dark" },
  { language: "pt", mode: "light" },
  { language: "pt", mode: "dark" },
] as const)(
  "$language/$mode uncertain step writes retain input and offer only reconciliation",
  async ({ language, mode }) => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const labels =
      language === "en"
        ? {
            save: "Save draft",
            finish: "Finish",
            details: "Details",
            extras: "Extras",
            confirm: "Confirm",
          }
        : {
            save: "Guardar rascunho",
            finish: "Concluir",
            details: "Detalhes",
            extras: "Extras",
            confirm: "Confirmar",
          };
    const input: StepperInput = {
      steps: [
        {
          id: "details",
          label: labels.details,
          optional: false,
          completion: "complete",
          problems: [],
        },
        {
          id: "extras",
          label: labels.extras,
          optional: true,
          completion: "incomplete",
          problems: [],
        },
        {
          id: "confirm",
          label: labels.confirm,
          optional: true,
          completion: "incomplete",
          problems: [],
        },
      ],
      currentId: "extras",
      phase: "editing",
      finish: { id: "finish", label: labels.finish, tone: "primary", state: "ready" },
      saveAndExit: { id: "save", label: labels.save, tone: "secondary", state: "ready" },
      dirty: true,
    };
    const callbacks = {
      onNext: jest.fn(),
      onBack: jest.fn(),
      onGo: jest.fn(),
      onSkip: jest.fn(),
      onFinish: jest.fn(),
      onSaveAndExit: jest.fn(),
      onReconcile: jest.fn(),
    };
    const view = (phase: StepperInput["phase"], currentId = "extras") => {
      const model = deriveStepper({ ...input, phase, currentId }, p);
      if (!model.ok) throw new Error(JSON.stringify(model.issues));
      return (
        <ThemeProvider mode={mode}>
          <View testID="stepper-surface">
            <Stepper model={model.value} {...callbacks}>
              <DraftField />
            </Stepper>
          </View>
        </ThemeProvider>
      );
    };
    await render(view("editing"));
    await fireEvent.changeText(screen.getByTestId("step-draft-input"), "Retained input 47");
    await fireEvent.press(screen.getByRole("button", { name: labels.save }));
    expect(callbacks.onSaveAndExit).toHaveBeenCalledTimes(1);
    callbacks.onSaveAndExit.mockClear();

    for (const currentId of ["extras", "confirm"]) {
      for (const phase of ["saving-exit", "write-unknown", "submitting", "finished"] as const) {
        await screen.rerender(view(phase, currentId));
        // The independent shell and retained field establish reachability before refusals.
        expect(screen.getByTestId("stepper-surface")).toBeOnTheScreen();
        expect(screen.getByTestId("step-draft-input").props.value).toBe("Retained input 47");
        expect(screen.getByText(p.copy.kit.unsaved)).toBeOnTheScreen();
        for (const button of screen.getAllByRole("button")) {
          if (button.props.accessibilityLabel === p.copy.state.reconcile) continue;
          expect(button).toBeDisabled();
          await fireEvent.press(button);
          await fireEvent(button, "accessibilityAction", {
            nativeEvent: { actionName: "activate" },
          });
        }
        for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
        if (phase === "write-unknown") {
          const reconcile = screen.getByRole("button", { name: p.copy.state.reconcile });
          expect(reconcile).toBeEnabled();
          await fireEvent(reconcile, "accessibilityAction", {
            nativeEvent: { actionName: "activate" },
          });
          expect(callbacks.onReconcile).toHaveBeenCalledTimes(1);
          callbacks.onReconcile.mockClear();
        } else {
          expect(screen.queryByRole("button", { name: p.copy.state.reconcile })).toBeNull();
        }
      }
    }
    await screen.rerender(view("failed", "confirm"));
    expect(screen.getByTestId("step-draft-input").props.value).toBe("Retained input 47");
    expect(screen.getByRole("button", { name: labels.finish })).toBeEnabled();
    expect(callbacks.onSaveAndExit).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: labels.save }));
    expect(callbacks.onSaveAndExit).toHaveBeenCalledTimes(1);
    for (const callback of [
      callbacks.onNext,
      callbacks.onBack,
      callbacks.onGo,
      callbacks.onSkip,
      callbacks.onFinish,
    ])
      expect(callback).not.toHaveBeenCalled();
  },
);
