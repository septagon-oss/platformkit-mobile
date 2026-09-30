import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCopy,
  deriveStepper,
  stepTransition,
  type Result,
  type StepEvent,
  type StepperInput,
} from "../src/core/derive";
import { presentation } from "./fakes/presentation";

function ok<T>(result: Result<T>): T {
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value;
}

test("T0180: pending step writes refuse every transition without returning or mutating a draft", () => {
  for (const language of ["en", "pt"] as const) {
    const p = { ...presentation, copy: deriveCopy(language) };
    const input: StepperInput = {
      steps: [
        { id: "details", label: "Details", optional: false, completion: "complete", problems: [] },
        { id: "extras", label: "Extras", optional: true, completion: "skipped", problems: [] },
        {
          id: "confirm",
          label: "Confirm",
          optional: false,
          completion: "incomplete",
          problems: [],
        },
      ],
      currentId: "confirm",
      phase: "editing",
      finish: { id: "finish", label: "Finish", tone: "primary", state: "ready" },
      saveAndExit: { id: "save", label: "Save draft", tone: "secondary", state: "ready" },
      dirty: true,
    };
    const before = JSON.stringify(input);
    const events: readonly StepEvent[] = [
      { kind: "back" },
      { kind: "go", stepId: "details" },
      { kind: "edited", stepId: "details" },
      { kind: "skip" },
      { kind: "validated", problems: [] },
      { kind: "validated", problems: [{ fieldId: "name", message: "Check this value" }] },
    ];
    for (const phase of ["saving-exit", "submitting", "write-unknown", "finished"] as const) {
      const pending = { ...input, phase };
      const model = ok(deriveStepper(pending, p));
      assert.equal(model.currentId, "confirm");
      assert.equal(model.progress, 2 / 3);
      assert.equal(model.dismissal, "confirm");
      assert.equal(model.finish?.enabled, false);
      assert.equal(model.saveAndExit?.enabled, false);
      assert.equal(model.back?.enabled, false);
      assert.ok(model.steps.every((step) => !step.canGo));
      assert.equal(model.reconcile?.enabled, phase === "write-unknown" ? true : undefined);
      for (const event of events) {
        const result = stepTransition(pending, event, p);
        assert.equal(result.ok, false, `${phase} must refuse ${event.kind}`);
        assert.equal("value" in result, false, "a refusal must not expose a partial draft");
        if (!result.ok) {
          assert.equal(result.issues[0]?.code, phase === "finished" ? "read-only" : "busy");
          assert.equal(
            result.issues[0]?.recovery,
            phase === "finished" ? "immutable" : "correctable",
          );
          assert.equal(result.issues[0]?.message, p.copy.kit.unavailable);
        }
      }
      assert.equal(JSON.stringify(input), before);
    }

    const recovered = ok(deriveStepper({ ...input, phase: "failed" }, p));
    assert.equal(recovered.finish?.enabled, true);
    assert.equal(recovered.saveAndExit?.enabled, true);
    assert.equal(recovered.reconcile, undefined);
    const back = ok(stepTransition({ ...input, phase: "failed" }, { kind: "back" }, p));
    assert.equal(back.currentId, "extras");
    assert.equal(back.steps[1]?.completion, "skipped");
    assert.equal(JSON.stringify(input), before);
    assert.equal(Object.isFrozen(input.steps), false);
    assert.ok(Object.isFrozen(back.steps));
  }
});

test("T0180: validation failure retains the current step and an explicit retry advances only one step", () => {
  const problems = [{ fieldId: "reference", message: "Confirm the reference" }];
  const steps = [
    {
      id: "identity",
      label: "Identity",
      optional: false,
      completion: "complete" as const,
      problems: [],
    },
    {
      id: "reference",
      label: "Reference",
      optional: false,
      completion: "incomplete" as const,
      problems: [],
    },
    {
      id: "finish",
      label: "Finish",
      optional: false,
      completion: "incomplete" as const,
      problems: [],
    },
  ];
  const input: StepperInput = {
    steps,
    currentId: "reference",
    phase: "validating",
    finish: { id: "finish", label: "Finish", tone: "primary", state: "ready" },
    dirty: true,
  };
  const before = JSON.stringify(input);
  const failed = ok(stepTransition(input, { kind: "validated", problems }, presentation));
  assert.equal(failed.currentId, "reference");
  assert.equal(failed.steps[1]?.completion, "incomplete");
  assert.deepEqual(failed.steps[1]?.problems, problems);
  const failedInput: StepperInput = { ...input, ...failed, phase: "failed" };
  const failedModel = ok(deriveStepper(failedInput, presentation));
  assert.deepEqual(failedModel.firstProblem, problems[0]);
  assert.equal(failedModel.next?.enabled, true);
  const lateSuccess = stepTransition(
    failedInput,
    { kind: "validated", problems: [] },
    presentation,
  );
  assert.equal(lateSuccess.ok, false, "a stale validation cannot advance a failed phase");
  assert.equal("value" in lateSuccess, false);
  const retried = ok(
    stepTransition(
      { ...failedInput, phase: "validating" },
      { kind: "validated", problems: [] },
      presentation,
    ),
  );
  assert.equal(retried.currentId, "finish");
  assert.equal(retried.steps[1]?.completion, "complete");
  assert.deepEqual(retried.steps[1]?.problems, []);
  assert.equal(
    ok(deriveStepper({ ...input, ...retried, phase: "editing" }, presentation)).finished,
    false,
  );
  assert.equal(JSON.stringify(input), before);
  assert.equal(Object.isFrozen(problems), false);
  problems[0]!.message = "Caller edited the problem";
  steps[1]!.label = "Caller edited the step";
  assert.equal(failedModel.firstProblem?.message, "Confirm the reference");
  assert.equal(failedModel.steps[1]?.label, "Reference");
});
