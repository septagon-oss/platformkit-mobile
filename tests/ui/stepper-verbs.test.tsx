// A stage asks for one thing. What moves it on, what excuses it and what leaves
// it are three different acts, so the screen does not offer them in one line
// beside each other — and what the stage is about stands above all of them,
// because a person answers the question before they decide to leave the room.
import React from "react";
import { expect, test } from "@jest/globals";
import { render, screen, within } from "@testing-library/react-native";
import { kitExamples, type Result } from "../../src/core/derive";
import { Stepper } from "../../src/ui/organisms/Stepper";
import { Text } from "../../src/ui/atoms/Text";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const ok = <T,>(result: Result<T>): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

const none = () => {};

for (const state of ["first", "middle", "last"] as const) {
  test(`${state}: the act of leaving a stage is not offered beside the act of moving it on`, async () => {
    const model = ok(kitExamples(presentation, `stepper/${state}`)).stepper;
    await render(
      <ThemeProvider mode="light">
        <Stepper
          model={model}
          onNext={none}
          onBack={none}
          onGo={none}
          onSkip={none}
          onFinish={none}
          onSaveAndExit={none}
          onReconcile={none}
        >
          <Text>{presentation.copy.kit.detailBody}</Text>
        </Stepper>
      </ThemeProvider>,
    );
    const verbs = screen.getByTestId("stepper-verbs"),
      exits = screen.getByTestId("stepper-exit");
    for (const control of [model.next, model.finish, model.skip])
      if (control) expect(within(verbs).getByText(control.label)).toBeTruthy();
    for (const control of [model.back, model.saveAndExit, model.reconcile])
      if (control) expect(within(exits).getByText(control.label)).toBeTruthy();
    if (model.saveAndExit) expect(within(verbs).queryByText(model.saveAndExit.label)).toBeNull();
    if (model.back) expect(within(verbs).queryByText(model.back.label)).toBeNull();
    const forward = model.next ?? model.finish;
    if (forward) expect(within(exits).queryByText(forward.label)).toBeNull();
    // The stage's own subject is read before any of its verbs.
    const drawn = JSON.stringify(screen.toJSON());
    expect(drawn.indexOf(presentation.copy.kit.detailBody)).toBeLessThan(
      drawn.indexOf("stepper-verbs"),
    );
  });
}
