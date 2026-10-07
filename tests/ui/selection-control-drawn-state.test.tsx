// "A state is visible or it is not a state." The selection control carries what a
// person did to it in `checked`, which reached the accessibility tree and nothing
// else: the marked box and the unmarked one were the same pixels, and every row of
// the data list inherits that control. The rule belongs where the drawing is
// decided — Button draws any control that carries a checked state, in either of the
// two spellings that state is written in — so that is what these measure.
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import { deriveChoices, deriveSelection, type Result } from "../../src/core/derive";
import { SelectionControl } from "../../src/ui/atoms/SelectionControl";
import { ChoiceChips } from "../../src/ui/molecules/ChoiceChips";
import { VerbStage } from "../../src/ui/verb";
import { ThemeProvider, themeFor } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const t = themeFor("light");

const ok = <T,>(result: Result<T>): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

const drawn = (id: string): Record<string, unknown> =>
  (StyleSheet.flatten(screen.getByTestId(id).props.style as object) ?? {}) as Record<
    string,
    unknown
  >;

test("the selection control draws the mark it announces", async () => {
  const marked = (selected: boolean) =>
    ok(deriveSelection({ label: "Audio guide", selected, enabled: true }, presentation));
  await render(
    <ThemeProvider mode="light">
      <SelectionControl model={marked(false)} onChange={() => {}} testID="unchecked" />
      <SelectionControl model={marked(true)} onChange={() => {}} testID="checked" />
    </ThemeProvider>,
  );
  const off = drawn("unchecked");
  const on = drawn("checked");
  // Two ways of saying the control is marked, neither resting on the other: the
  // surface it sits on and the edge around it.
  expect(off.backgroundColor).not.toBe(on.backgroundColor);
  expect(off.borderColor).not.toBe(on.borderColor);
  expect(on.backgroundColor).toBe(t.state.selected);
  expect(on.borderColor).toBe(t.color.accentDefault);
});

test("a choice outside the screen's filled verb still shows which one it is on", async () => {
  const model = ok(
    deriveChoices(
      {
        id: "option",
        label: "Pass option",
        choices: [
          { id: "first", label: "Individual", enabled: true },
          { id: "second", label: "Two adults", enabled: true },
        ],
        selectedId: "second",
        required: false,
      },
      presentation,
    ),
  );
  // The specimen is a companion, so nothing in it is filled: tone cannot be what
  // tells the chosen chip from the others, because both are outlined here.
  await render(
    <VerbStage lead={false}>
      <ThemeProvider mode="light">
        <ChoiceChips model={model} onChange={() => {}} testID="chips" />
      </ThemeProvider>
    </VerbStage>,
  );
  expect(drawn("chips/second").borderColor).toBe(t.color.accentDefault);
  expect(drawn("chips/second").backgroundColor).toBe(t.state.selected);
  expect(drawn("chips/first").borderColor).toBe(t.state.outline);
  expect(drawn("chips/first").backgroundColor).toBe(t.color.surfacePrimary);
});
