// A refusal — the phone's own or the server's — belongs to the step that asked the field, and
// the walk goes back there whatever order the sentences arrived in. A sentence naming no step
// of this walk moves nobody: it is read over the sheet the person is standing in.
import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import {
  deriveStepper,
  formControls,
  problems,
  stepOwning,
  stepProblems,
  steppedForm,
  stepRefusals,
  stepTransition,
  walkSteps,
  type FormWords,
  type StepperInput,
} from "../src/core/form";
import { deriveCopy } from "../src/core/derive";
import { presentation } from "./fakes/presentation";
import { steppedNote } from "./fakes/steps";

const words: FormWords = deriveCopy("en").kit;
const entry = parseCatalog(steppedNote(), () => {}).resources[0]!;
const steps = steppedForm(entry, true)!;
const controls = formControls(entry, undefined, true);

test("a step refuses on its own fields, in the order it asks them", () => {
  // `title` is the note's one required field and it sits on the first step alone.
  assert.deepEqual(stepProblems(steps[0]!, controls, { title: "" }, words), [
    { fieldId: "title", message: words.fieldRequired("Title") },
  ]);
  assert.deepEqual(stepProblems(steps[1]!, controls, { title: "" }, words), []);
  assert.deepEqual(stepProblems(steps[2]!, controls, { title: "Autumn" }, words), []);
});

test("the step owning a refusal is the earliest one that asked the field", () => {
  assert.equal(stepOwning(steps, { tags: "is not a list" }), "section:options");
  assert.equal(stepOwning(steps, { rank: "is not a number", title: "is taken" }), "unsectioned");
  assert.equal(stepOwning(steps, { rank: "x", tags: "y" }), "section:details");
  assert.equal(stepOwning(steps, { status: "is closed" }), undefined);
});

test("a refused write marks every step that asked a named field and lands on the first", () => {
  const stages = walkSteps(
    steps.flatMap((s) => [
      {
        key: s.key,
        label: s.label,
        controls: controls.filter((c) => (s.fields ?? []).includes(c.field.name)),
      },
    ]),
    steps,
    {},
    {},
  );
  const input: StepperInput = {
    steps: stages.map((s, i) => (i === 0 ? s : { ...s, completion: "complete" as const })),
    currentId: "section:options",
    phase: "failed",
    finish: { id: "save", label: "Save note", tone: "primary", state: "ready" },
    dirty: true,
  };
  const moved = stepTransition(
    input,
    stepRefusals({ tags: "is not a list", body: "is too long" }),
    presentation,
  );
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assert.equal(moved.value.currentId, "section:details", "the earliest step that was asked");
  const marked = moved.value.steps.filter((s) => s.problems.length > 0).map((s) => s.id);
  assert.deepEqual(marked, ["section:details", "section:options"]);
  const drawn = deriveStepper(
    { ...input, steps: moved.value.steps, currentId: moved.value.currentId },
    presentation,
  );
  assert.equal(drawn.ok && drawn.value.currentId, "section:details");

  const untouched = stepTransition(input, stepRefusals({ status: "is closed" }), presentation);
  assert.equal(untouched.ok, true);
  if (!untouched.ok) return;
  assert.equal(
    untouched.value.currentId,
    "section:options",
    "a refusal no step asked leaves the position",
  );
  assert.deepEqual(
    untouched.value.steps.map((s) => s.problems.length),
    [0, 0, 0],
  );
});

test("a whole-form refusal is still what the write answers to, steps or no steps", () => {
  // The step's own `problems` and the sheet's whole-form ones are one implementation: the
  // same call asked of fewer controls, so nothing about the write's door changed.
  const whole = problems(controls, { title: "" }, words);
  assert.deepEqual(Object.keys(whole), ["title"]);
  assert.deepEqual(
    stepProblems(steps[0]!, controls, { title: "" }, words)[0]!.message,
    whole.title,
  );
});
