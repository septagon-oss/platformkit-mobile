/* A stepped create form over the kernel's note record, in the member spelling a server prints.
 *
 * `testdata/catalog.deck.json` is the kernel's resolved capture and it states one stepped form —
 * the note's update form, one step, all five editable fields, wearing "Save the note" — which the
 * capture's own cases read unchanged, so the kernel's bytes are never only paraphrased here. What
 * this file adds is the same member asked of the create form in three steps, for what one step
 * cannot show: that a step asks its own fields and nothing else, that its verb names the answer it
 * chose, and that a refusal lands the person back on the step that asked. The entry, the sections
 * and the five editable names are the capture's; the three steps are this repository's declaration
 * in that member shape. */
import { readFileSync } from "node:fs";
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// The capture is read from the repository root, the way every other fixture in this
// directory reads what `testdata/` holds: the suites run with the root as their working
// directory, so one path names the file for both the Node suite and the device suite.
const CAPTURE = "testdata/catalog.deck.json";

/** createSteps is a three-step create form over the capture's five editable fields. */
export const createSteps = (): Json[] => [
  {
    key: "unsectioned",
    section: "",
    label: "Details",
    fields: ["title"],
    primaryLabel: "Next · {answer}",
    answerField: "title",
    emptyLabel: "Enter a title",
  },
  {
    key: "section:details",
    section: "details",
    label: "Description",
    fields: ["body", "rank"],
    primaryLabel: "Next",
    answerField: "",
    emptyLabel: "",
  },
  {
    key: "section:options",
    section: "options",
    label: "Options",
    fields: ["pinned", "tags"],
    primaryLabel: "Save note",
    answerField: "",
    emptyLabel: "",
  },
];

/** stepSections is where the capture files those fields, as its resolved layout states it. */
export const stepSections = (): Json[] => [
  { key: "details", label: "Description", fields: ["body", "rank"] },
  { key: "options", label: "Options", fields: ["pinned", "tags"] },
];

/**
 * steppedNote is one catalogue document: the capture's note entry, its resolved block
 * stating a stepped create form in place of the update form it prints — per-form opt-in, so
 * of the same entry stays flat while its create sheet walks. `mutate` takes the entry as
 * the document holds it, which is how a case names the one member it is refusing.
 */
export function steppedNote(mutate?: (note: Json) => void): Json {
  const capture = JSON.parse(readFileSync(CAPTURE, "utf8").toString()) as Json;
  const note = capture.resources[0] as Json;
  const resolved = note.resolved as Json;
  resolved.layout.sections = stepSections();
  resolved.layout.forms = { createForm: { layout: "steps", steps: createSteps() } };
  mutate?.(note);
  return { catalogVersion: 3, resources: [note] };
}
