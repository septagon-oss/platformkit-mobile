// A form keeps what the person typed, and says exactly what to fix (0085). Four rules
// decide that, and all four are answers of the core: what the sheet may refuse on
// submit is `problems` — a required field left empty, a value that is not of its
// kind — in sentences that name the field; which field it then waits on is
// `firstProblem`, read out of the sheet's own asked order and never out of the key
// order a refusal arrived in; whether anything is worth discarding at all is
// `changedFields`, which asks what differs rather than what was touched; and what a
// whole-row replace carries is `writeControls`, which keeps the writable fields the
// sheet was never shown so a PUT cannot clear them by omission.
//
// The sentences themselves are the copy table's, in both languages, before a screen
// may hold one: the core writes no sentence and `FormWords` is the seam. Every case
// below is served bytes through the shipped `parseCatalog`, with the mutations named
// where they are used — a required switch, a hidden field, an immutable one.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import { deriveCopy } from "../src/core/copy";
import {
  changedFields,
  firstProblem,
  formControls,
  formSections,
  problems,
  values,
  writeControls,
  type Control,
  type Row,
} from "../src/core/derive";

const kit = deriveCopy("en").kit;
const pt = deriveCopy("pt").kit;

const bytes = (name: string) =>
  JSON.parse(readFileSync(new URL(`../testdata/${name}`, import.meta.url).pathname, "utf8"));

/**
 * note is the served catalogue document, mutated as a case says, through the parser a
 * screen uses. A case that expects no hint defect fails on the first notice, so a
 * mutation the parser is meant to notice is a promise kept, not a mistake to ignore.
 */
function noteEntry(mutate: (resource: Record<string, unknown>) => void = () => undefined): Entry {
  const doc = bytes("catalog.json");
  mutate(doc.resources[0]);
  return parseCatalog(doc).resources[0]!;
}

/** declares adds a field this fixture holds none of — a date, a closed set — and asks for it. */
const declares = (field: Record<string, unknown>) => (resource: Record<string, unknown>) => {
  (resource.fields as Record<string, unknown>[]).push(field);
};

/**
 * hinted is the served hinted document (T-0328's), whose `note` already hides one
 * field: the case that asks what a whole-row replace carries is asked of the document
 * this repository actually serves, not of a mutation that imitates it.
 */
function hintedEntry(mutate: (resource: Record<string, unknown>) => void = () => undefined): Entry {
  const doc = bytes("catalog.hints.json");
  mutate(doc.resources[0]);
  return parseCatalog(doc).resources[0]!;
}

/** requires is the same demand made of a field the fixture already has. */
const required = (name: string) => (resource: Record<string, unknown>) => {
  const field = (resource.fields as Record<string, unknown>[]).find((f) => f.name === name)!;
  field.required = true;
};

const hidden = (name: string) => (resource: Record<string, unknown>) => {
  const field = (resource.fields as Record<string, unknown>[]).find((f) => f.name === name)!;
  field.presentation = {
    ...(field.presentation as object | undefined),
    visibility: "hidden",
  } as Record<string, unknown>;
};

/** controls is the sheet's own list for a row read back, in the order it asks. */
const controls = (e: Entry, row: Row | undefined = undefined): readonly Control[] =>
  formSections(e, row, row === undefined, kit.overview).flatMap((b) => b.controls);

test("an empty required field is refused in a sentence naming it, ahead of every other field", () => {
  const entry = noteEntry();
  const sheet = controls(entry);
  // Validation on submit, and the sentence is the kit's: "Enter a title." for the
  // box a person types into, spelled with the label they read above it.
  assert.deepEqual(problems(sheet, {}, kit), { title: "Enter a title." });
  // A field that holds something keeps whatever it had to say about itself, and the
  // required refusal does not smother the rest: both are named, in asked order.
  // and they are named in the order the sheet asks, not in the order the values
  // happened to be held: this is what lets the sheet know which field to ask for.
  assert.deepEqual(problems(sheet, { rank: "many" }, kit), {
    title: "Enter a title.",
    rank: "Enter a valid number.",
  });
  assert.deepEqual(Object.keys(problems(sheet, { rank: "many" }, kit)), ["title", "rank"]);
  assert.deepEqual(problems(sheet, { title: "Buy milk" }, kit), {});
});

test("a value chosen rather than typed asks to be chosen", () => {
  // A date the person never picked is not a date they left blank in a box; the
  // sentence says choose, and it names the field the same way.
  const entry = noteEntry(
    declares({ name: "due", type: "time", required: true, presentation: { label: "Due date" } }),
  );
  const sheet = controls(entry, {} as Row);
  const due = sheet.find((c) => c.field.name === "due");
  assert.ok(due !== undefined && due.kind === "datetime", "the mutation made a date row");
  assert.deepEqual(problems(sheet, {}, kit), {
    title: "Enter a title.",
    due: "Choose a due date.",
  });
  assert.equal(kit.fieldChoiceRequired("Due date"), "Choose a due date.");
  // A closed set is chosen too, and a switch is not: it always answers.
  const choice = noteEntry(
    declares({ name: "coverage", type: "string", enum: ["some", "all"], required: true }),
  );
  const coverage = controls(choice, {} as Row).find((c) => c.field.name === "coverage");
  assert.ok(coverage !== undefined && coverage.kind === "select", "a closed set is a choice");
  // The sentence names the field the person is looking at, never one of its values.
  assert.deepEqual(problems([coverage], {}, kit), { coverage: "Choose a coverage." });
});

test("a number that is not one and an instant that is not one say so in sentences", () => {
  const sheet = controls(
    noteEntry(declares({ name: "due", type: "time", presentation: { label: "Due date" } })),
    {} as Row,
  );
  const named = (name: string) => sheet.filter((c) => c.field.name === name);
  // Both answers name what to mend; neither quotes the wire. These are the two
  // fragments this build used to print — "is not a number" and "is not a time".
  assert.deepEqual(problems(named("rank"), { title: "x", rank: "many" }, kit), {
    rank: "Enter a valid number.",
  });
  assert.deepEqual(problems(named("due"), { due: "tomorrow" }, kit), {
    due: "Enter a valid date and time.",
  });
  assert.deepEqual(problems(named("rank"), { rank: "3" }, kit), {});
});

test("a switch answers for itself, and an immutable value nobody may fill stays unfilled", () => {
  const pinned = controls(noteEntry(required("pinned"))).find((c) => c.field.name === "pinned");
  assert.ok(pinned !== undefined && pinned.kind === "switch", "pinned is a switch");
  // A required switch holds "" on a create and `values` reads that as off, so a
  // refusal here could only ever be refused by moving the switch — which is what an
  // "off" answer already is.
  assert.deepEqual(problems([pinned], {}, kit), {});
  // The note's own lifecycle state is immutable: the sheet draws it greyed and this
  // form cannot be the thing that fills it in, so it never asks for it.
  const status = controls(noteEntry(required("status")), {} as Row).find(
    (c) => c.field.name === "status",
  );
  assert.ok(status !== undefined && status.readOnly, "an immutable field is drawn read-only");
  assert.deepEqual(problems([status], {}, kit), {});
});

test("English reads its article, Portuguese needs none", () => {
  assert.equal(kit.fieldRequired("Title"), "Enter a title.");
  assert.equal(kit.fieldRequired("Tags"), "Enter tags.");
  assert.equal(kit.fieldRequired("E-mail"), "Enter an e-mail.");
  assert.equal(kit.fieldChoiceRequired("Due date"), "Choose a due date.");
  assert.equal(kit.fieldNumber, "Enter a valid number.");
  assert.equal(kit.fieldTime, "Enter a valid date and time.");
  // Portuguese puts the label after a colon, where no article, no agreement and no
  // grammatical gender rule exists — the construction `untitled` already uses.
  assert.equal(pt.fieldRequired("Due date"), "Campo obrigatório: Due date.");
  assert.equal(pt.fieldChoiceRequired("Due date"), "Campo obrigatório: Due date.");
  assert.equal(pt.fieldNumber, "Introduza um número válido.");
  assert.equal(pt.fieldTime, "Introduza uma data e hora válidas.");
  // What a write says, in both languages, and what a discard asks.
  assert.equal(kit.created("Note"), "Note created");
  assert.equal(pt.created("Note"), "Registo criado: Note");
  assert.equal(kit.changesSaved, "Changes saved");
  assert.equal(pt.changesSaved, "Alterações guardadas");
  assert.equal(kit.discardChanges, "Discard changes?");
  assert.equal(pt.discardChanges, "Descartar alterações?");
  assert.equal(kit.keepEditing, "Keep editing");
  assert.equal(pt.keepEditing, "Continuar a editar");
  assert.equal(kit.discard, "Discard");
  assert.equal(pt.discard, "Descartar");
});

test("a value that came back the same was not changed", () => {
  const row = { id: "1", title: "Buy milk", rank: 3, pinned: true };
  const sheet = controls(noteEntry(), row);
  // Nothing typed: nothing changed, whatever the row holds.
  assert.deepEqual(changedFields(sheet, {}), []);
  // Typed the same word back: the person did not change the row.
  assert.deepEqual(changedFields(sheet, { title: "Buy milk" }), []);
  // Typed something else, then the number and the switch read back as their row
  // says them: only the title differs, and it is the only one worth a question.
  assert.deepEqual(changedFields(sheet, { title: "Buy", rank: "3", pinned: "true" }), ["title"]);
  // A switch moved is a change, and a switch moved back is not.
  assert.deepEqual(changedFields(sheet, { pinned: "false" }), ["pinned"]);
  // A field the person never touched is not named because its row is missing.
  assert.deepEqual(changedFields(sheet, { body: "" }), []);
});

test("the first field the sheet asks for is the one with a sentence", () => {
  const sheet = controls(
    noteEntry(
      declares({ name: "due", type: "time", required: true, presentation: { label: "Due date" } }),
    ),
    {} as Row,
  );
  // The order is the sheet's — the identity field, then required, then optional —
  // and not the record's: a refusal that names its fields in the opposite order
  // still asks for the field this person meets first.
  assert.ok(
    sheet.findIndex((c) => c.field.name === "title") <
      sheet.findIndex((c) => c.field.name === "rank"),
    "the required field is asked for before the optional one",
  );
  assert.equal(
    firstProblem(sheet, { rank: "Enter a valid number.", title: "Enter a title." }),
    "title",
  );
  assert.equal(firstProblem(sheet, { rank: "Enter a valid number." }), "rank");
  assert.equal(firstProblem(sheet, {}), undefined);
  // A sentence about a field the sheet does not draw asks for nothing: a hidden
  // field's refusal is coloured where it is named, not focused where it is not.
  assert.equal(firstProblem(sheet, { nowhere: "is required" }), undefined);
});

test("a whole-row write keeps what the sheet was not shown", () => {
  const entry = hintedEntry();
  const row = { id: "1", title: "Buy milk", body: "two errands", status: "open", rank: 4 };
  const sheet = formControls(entry, row, false);
  const drawn = sheet.map((c) => c.field.name);
  assert.ok(!drawn.includes("rank"), "a hidden field is not drawn");
  const body = values(writeControls(entry, row, sheet), { title: "New title" });
  // The hidden plumbing and the immutable state both travel with the write, because
  // a PUT that left one out would be a PUT that cleared it.
  // `pinned` and `tags` are the sheet's own drawn fields and answer for themselves —
  // a switch is always on or off, a joined list's blank is its own empty list — which
  // is `values`' rule, unchanged by what was added here.
  assert.deepEqual(body, {
    title: "New title",
    body: "two errands",
    status: "open",
    rank: 4,
    pinned: false,
    tags: [],
  });
  // The server's own three never travel back in a body that replaces a row.
  assert.ok(!("id" in body) && !("createdAt" in body) && !("updatedAt" in body));
  // A field neither the read returned nor the sheet asks is not invented, and a
  // field the sheet asks is sent even when the row lacked it — the person answered.
  const sparse = values(writeControls(entry, { id: "1", title: "Buy milk" }, sheet), {
    body: "one errand",
  });
  assert.deepEqual(sparse, { title: "Buy milk", body: "one errand", pinned: false, tags: [] });
});
