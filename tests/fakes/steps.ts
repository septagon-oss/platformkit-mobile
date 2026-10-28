// The kernel's stepped create form, in the wire spelling a server prints.
//
// `kit/entity/present/form_steps_test.go` resolves the note entry with sections
// `details` and `options` into three steps, and states the copy each step wears. Those
// are the same bytes written out here — same keys, same field groups, same verbs — so an
// assertion about this fake is an assertion about the kernel's own answer, and a phone
// that walked a different three steps would fail it. The entry underneath is the
// kernel's note record as the kernel resolved it (`testdata/catalog.deck.json`), which is
// why the five editable names are the ones the capture itself lists.
import { readFileSync } from "node:fs";
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// The capture is read from the repository root, the way every other fixture in this
// directory reads what `testdata/` holds: the suites run with the root as their working
// directory, so one path names the file for both the Node suite and the device suite.
const CAPTURE = "testdata/catalog.deck.json";

/** createSteps is the kernel's three-step create form, member for member. */
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

/** stepSections is where the kernel filed those fields, as the resolved layout states it. */
export const stepSections = (): Json[] => [
  { key: "details", label: "Description", fields: ["body", "rank"] },
  { key: "options", label: "Options", fields: ["pinned", "tags"] },
];

/**
 * steppedNote is one catalogue document: the kernel's note entry, its resolved block
 * stating a stepped create form and no update form — per-form opt-in, so the edit sheet
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
