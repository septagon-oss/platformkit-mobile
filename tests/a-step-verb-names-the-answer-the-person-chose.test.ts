// The verb a step wears is the step's own sentence with the person's own answer in it: the
// kernel's answer rule read line for line, so a closed set says its answers' labels and never
// the ids a row stores, and anything this phone cannot read wears the step's empty label
// rather than a raw value in a button.
import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { formControls, steppedForm, stepVerb, walkSteps } from "../src/core/form";
import type { PolicyStep } from "../src/core/catalogPolicy";
import { steppedNote } from "./fakes/steps";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * answerState is the kernel's create case with a closed set asked on the first step: the note's
 * `status` is the entry's one finite question, and the step that asks it wears its answer.
 */
const answerState = (note: Json): void => {
  // The kernel resolved `status` as neither editable nor writable by a person: the note's
  // own status is the server's. A form that asks the state as an answer says so on each of
  // the three places the phone reads that from — the layout's list, the resolved field's
  // editability, and the entry's immutable set.
  note.resolved.layout.create = [...note.resolved.layout.create, "status"];
  note.resolved.fields.find((f: Json) => f.name === "status").editable.create = true;
  note.immutable = note.immutable.filter((n: string) => n !== "status");
  const step = note.resolved.layout.forms.createForm.steps[0] as Json;
  step.fields = ["title", "status"];
  step.answerField = "status";
  step.primaryLabel = "Next · {answer}";
  step.emptyLabel = "Pick a state";
};

const controlsFor = (mutate: (note: Json) => void) => {
  const entry = parseCatalog(steppedNote(mutate), () => {}).resources[0]!;
  return { controls: formControls(entry, undefined, true), steps: steppedForm(entry, true)! };
};

const held = (answers: Record<string, string>) => answers;

test("a step naming no answer field says its literal verb whatever the boxes hold", () => {
  const { controls, steps } = controlsFor(() => {});
  const [first, second, last] = steps;
  assert.equal(stepVerb(last!, controls, held({}), {}), "Save note");
  assert.equal(stepVerb(second!, controls, held({ title: "Autumn" }), {}), "Next");
  // A typed answer is no interpolation for a literal label: the verb is the server's word.
  assert.equal(stepVerb(last!, controls, held({ tags: "{answer}" }), {}), "Save note");
  // A typed box answers with what the person wrote.
  assert.equal(stepVerb(first!, controls, held({ title: "Autumn" }), {}), "Next · Autumn");
});

test("a closed set wears its answers' labels, in the order the person chose them", () => {
  const { controls, steps } = controlsFor(answerState);
  const [first] = steps;
  assert.equal(stepVerb(first!, controls, held({ status: "open" }), {}), "Next · Open");
  assert.equal(
    stepVerb(first!, controls, held({ status: "open, done" }), {}),
    "Next · Open, Done",
    "each comma-part is its option's own word",
  );
});

test("an answer this phone cannot read wears the step's empty label", () => {
  const { controls, steps } = controlsFor(answerState);
  const [first] = steps;
  assert.equal(stepVerb(first!, controls, held({ status: "" }), {}), "Pick a state");
  assert.equal(stepVerb(first!, controls, held({ status: "   " }), {}), "Pick a state");
  // Nobody has typed in the box yet: the entry's own default is what the box holds, and
  // a verb that quoted nothing while the person could read a state would lie about both.
  assert.equal(stepVerb(first!, controls, held({}), {}), "Next · Open");
  assert.equal(stepVerb(first!, controls, held({ status: "shiny" }), {}), "Pick a state");
  assert.equal(stepVerb(first!, controls, held({ status: "open, shiny" }), {}), "Pick a state");
  assert.equal(
    stepVerb(first!, controls, held({ status: "open" }), { status: "is not an open state" }),
    "Pick a state",
    "a field carrying a sentence cannot be the answer a verb quotes",
  );
});

test("a step whose answer is a text box says what was typed", () => {
  const { controls, steps } = controlsFor(() => {});
  const [first] = steps;
  assert.equal(stepVerb(first!, controls, held({ title: "" }), {}), "Enter a title");
  assert.equal(
    stepVerb(first!, controls, held({ title: " Terracotta " }), {}),
    "Next · Terracotta",
  );
  assert.equal(
    stepVerb(first!, controls, held({ title: "x" }), { title: "is taken" }),
    "Enter a title",
  );
});

test("the walk a stepper draws carries each step's verb and its own fields", () => {
  const { controls, steps } = controlsFor(answerState);
  const blocks = [
    {
      key: steps[0]!.key,
      label: steps[0]!.label,
      controls: controls.filter((c) => (steps[0]!.fields ?? []).includes(c.field.name)),
    },
  ];
  const stages = walkSteps(blocks, steps, held({ status: "done" }), {});
  assert.equal(stages.length, 1);
  assert.equal(stages[0]!.id, "unsectioned");
  assert.equal(stages[0]!.label, "Details");
  assert.equal(stages[0]!.primary, "Next · Done");
  assert.deepEqual(stages[0]!.fields, ["title", "status"]);
  assert.equal(stages[0]!.optional, false, "a step owing a required answer is not skippable");
});
