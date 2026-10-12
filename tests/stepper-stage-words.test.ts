// The word under a stage of a staged task is the stage's own. "Required" is about
// what a person owes; a stage that can be skipped owes nothing, and a screen that
// says otherwise reads as a contradiction next to an enabled finish action.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy } from "../src/core/copy";
import { deriveStepper, type Action, type StepperInput } from "../src/core/derive";
import type { Presentation } from "../src/core/presentation";

const english: Presentation = {
  copy: deriveCopy("en"),
  locale: "en-GB",
  timeZone: "UTC",
  ownZone: "UTC",
  now: "2026-08-14T12:00:00Z",
  weekStartsOn: 1,
  motion: "reduced",
};
const portuguese: Presentation = { ...english, copy: deriveCopy("pt"), locale: "pt-PT" };

const finish: Action = { id: "finish", label: "Finish", tone: "primary", state: "ready" };

function stages(language: Presentation) {
  const input: StepperInput = {
    steps: [
      {
        id: "details",
        label: "Your details",
        optional: false,
        completion: "complete",
        problems: [],
      },
      {
        id: "payment",
        label: "Payment",
        optional: true,
        completion: "incomplete",
        problems: [],
      },
    ],
    currentId: "payment",
    phase: "editing",
    finish,
    dirty: false,
  };
  const result = deriveStepper(input, language);
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value.steps.map((step) => step.displayLabel);
}

test("an optional stage that is not done yet is named for what it is", () => {
  assert.deepEqual(stages(english), ["Your details · Complete", "Payment · Optional"]);
});

test("a stage a person owes is still the only one called required", () => {
  const owed = deriveStepper(
    {
      steps: [
        {
          id: "details",
          label: "Your details",
          optional: false,
          completion: "complete",
          problems: [],
        },
        {
          id: "payment",
          label: "Payment",
          optional: false,
          completion: "incomplete",
          problems: [],
        },
      ],
      currentId: "payment",
      phase: "editing",
      finish,
      dirty: false,
    },
    english,
  );
  assert.ok(owed.ok, owed.ok ? "" : JSON.stringify(owed.issues));
  assert.deepEqual(
    owed.value.steps.map((step) => step.stateLabel),
    ["Complete", "Required"],
  );
});

test("the stage words come from the bundle in both languages", () => {
  assert.deepEqual(stages(portuguese), ["Your details · Concluído", "Payment · Opcional"]);
});

test("the screen says where the person is, not the arithmetic behind it", () => {
  const model = deriveStepper(
    {
      steps: [
        { id: "a", label: "One", optional: false, completion: "incomplete", problems: [] },
        { id: "b", label: "Two", optional: true, completion: "skipped", problems: [] },
        { id: "c", label: "Three", optional: false, completion: "incomplete", problems: [] },
      ],
      currentId: "b",
      phase: "editing",
      finish,
      dirty: false,
    },
    english,
  );
  assert.ok(model.ok, model.ok ? "" : JSON.stringify(model.issues));
  assert.equal(model.value.progressText, "Step 2 of 3 · 1 skipped");
  assert.equal(model.value.progressLabel, "Steps: 1/3; Skipped: 1");
});
