// A list row says which record it is, what state that record is in, and what sets it
// apart — and nothing else. The four answers come from four declarations (the field the
// entry leads with, the state it declares, the line it writes about itself, the couple
// of values beside the line), the pill is coloured only by what the document declared
// for that value, the declared state is the pill and never one of those two values,
// plumbing is never drawn whoever pointed at it, and a value nobody answered prints no
// cell and no dash. An entry that declares no state shows no pill: the kit never guesses
// one from "the first enum field".
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import {
  deriveCopy,
  listRow,
  recordHeader,
  recordInformation,
  statusPill,
  type Row,
} from "../src/core/derive";
import { feedback, presentation } from "./fakes/presentation";

const untitled = presentation.copy.kit.untitled;
const golden = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url), "utf8"));
const hinted = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.hints.json", import.meta.url), "utf8"));

/** One entry of the hinted document, as its author described it. */
function hintEntry(mutate: (entry: Record<string, unknown>) => void = () => {}): Entry {
  const doc = hinted();
  mutate(doc.resources[0]);
  return parseCatalog(doc, (at, why) => {
    assert.fail(`${at} ${why}`);
  }).resources[0]!;
}

/** One entry of the un-hinted golden, with the hints this case is about stamped on it. */
function plainEntry(hints: Record<string, unknown> = {}): Entry {
  const doc = golden();
  doc.resources[0].presentation = hints;
  return parseCatalog(doc).resources[0]!;
}

/** The served golden, fresh, with one field's own word about itself changed. */
function fieldSays(name: string, hints: Record<string, unknown>): Entry {
  const doc = golden();
  const field = (doc.resources[0].fields as Record<string, unknown>[]).find(
    (f) => f.name === name,
  )!;
  field.presentation = hints;
  return parseCatalog(doc).resources[0]!;
}

const task: Row = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Fix the door",
  body: "The front door lock sticks in the morning.",
  status: "open",
  pinned: true,
  rank: 3,
  createdAt: "2026-07-18T08:00:00Z",
  updatedAt: "2026-07-18T08:30:00Z",
};

test("a hinted row names its record, says its state, and quotes none of its plumbing", () => {
  const row = listRow(hintEntry(), task, presentation, untitled);
  assert.equal(row.title, "Fix the door");
  assert.deepEqual(row.status, { label: "Em aberto", tone: "warning", symbol: "none" });
  assert.equal(row.summary, "The front door lock sticks in the morning.");
  const said = JSON.stringify(row);
  assert.ok(!said.includes("11111111"), "the identifier a scan cannot read is not on a row");
  assert.ok(!said.includes("2026-07-18"), "neither stamp a person never scans is on a row");
});

test("an entry that declares no state shows no pill, and says so by having no member", () => {
  const row = listRow(plainEntry(), task, presentation, untitled);
  // Not `undefined`, which an old row could carry: a pill that was never drawn
  // leaves no member behind, so no drawer can print an empty one.
  assert.equal(Object.keys(row).includes("status"), false);
  assert.equal(statusPill(plainEntry(), task, presentation), undefined);
  // The same field still narrows the list: a filter asks a different question.
  assert.equal(
    plainEntry()
      .fields.filter((f) => f.enum && f.enum.length > 0)
      .some((f) => f.name === "status"),
    true,
  );
});

test("a pill's colour comes from the tone declared for its value, and nowhere near its position", () => {
  const doc = hinted();
  const status = (doc.resources[0].fields as Record<string, unknown>[]).find(
    (f) => f.name === "status",
  )!;
  // `done` is the enum's last member. Declared danger, it reads danger; declared
  // nothing, it reads neutral; and a tone declared for the *first* value says
  // nothing about the second one.
  status.presentation = {
    enumLabels: { open: "Open", done: "Done" },
    enumTones: { done: "danger" },
  };
  const declared = parseCatalog(doc).resources[0]!;
  assert.deepEqual(statusPill(declared, { status: "done" }, presentation), {
    label: "Done",
    tone: "danger",
  });
  assert.deepEqual(statusPill(declared, { status: "open" }, presentation), {
    label: "Open",
    tone: "neutral",
  });
  const noTones = hintEntry((e) => {
    const f = (e.fields as Record<string, unknown>[]).find((x) => x.name === "status")!;
    f.presentation = { enumLabels: { open: "Open", done: "Done" } };
  });
  assert.equal(statusPill(noTones, { status: "done" }, presentation)?.tone, "neutral");
});

test("no value answers, no pill — except a switch, whose no is a fact", () => {
  const entry = hintEntry();
  assert.equal(statusPill(entry, { title: "x" }, presentation), undefined);
  assert.equal(statusPill(entry, { status: "" }, presentation), undefined);
  const pinned = hintEntry(
    (e) => (e.presentation = { ...(e.presentation as object), statusField: "pinned" }),
  );
  assert.deepEqual(statusPill(pinned, { pinned: false }, presentation), {
    label: "No",
    tone: "neutral",
  });
});

test("a row shows at most two values, in the order its author gave them", () => {
  assert.deepEqual(
    listRow(plainEntry(), task, presentation, untitled).cells.map((c) => c.id),
    ["status", "pinned"],
  );
  const authors = plainEntry({ summaryFields: ["rank", "status"] });
  assert.deepEqual(
    listRow(authors, task, presentation, untitled).cells.map((c) => c.id),
    ["rank", "status"],
    "the author's order, not the kit's ranking",
  );
  for (const c of listRow(authors, task, presentation, untitled).cells)
    assert.ok(
      !["id", "createdAt", "updatedAt", "title", "body"].includes(c.id),
      `${c.id} is not a row's value`,
    );
});

test("plumbing is never a cell whoever pointed at it", () => {
  const row = listRow(
    plainEntry({ summaryFields: ["createdAt", "status"] }),
    task,
    presentation,
    untitled,
  );
  assert.deepEqual(
    row.cells.map((c) => c.id),
    ["status"],
  );
  assert.equal(JSON.stringify(row).includes("2026-07-18"), false);
  // The parse refuses a typo, not a stamp: the row answers plumbing and the parser
  // answers rubbish, and one sentence must not do both jobs.
  const lines: string[] = [];
  const doc = golden();
  doc.resources[0].presentation = { summaryFields: ["createdAt", "whoKnows"] };
  parseCatalog(doc, (at, why) => lines.push(`${at} ${why}`));
  assert.deepEqual(
    lines.filter((l) => l.includes("createdAt")),
    [],
  );
  assert.equal(lines.length, 1, lines.join("\n"));
});

test("a value nobody answered prints no cell, and no dash stands in for it", () => {
  const entry = plainEntry({ summaryFields: ["rank", "pinned"] });
  const row = listRow(entry, { id: "1", title: "x", pinned: false }, presentation, untitled);
  assert.deepEqual(
    row.cells.map((c) => c.id),
    ["pinned"],
  );
  assert.equal(JSON.stringify(row).includes("—"), false);
});

test("a row's time cell keeps both spellings of the instant through the composed row", () => {
  const meeting: Entry = {
    module: "meeting",
    entity: "meeting",
    path: "/api/v1/meeting/meetings",
    writable: true,
    singleton: false,
    immutable: [],
    commands: [],
    fields: [
      { name: "id", type: "uuid", readOnly: true },
      { name: "topic", type: "string" },
      { name: "heldAt", type: "time" },
      { name: "minutes", type: "int" },
    ],
  };
  const cell = listRow(
    meeting,
    { id: "m1", topic: "Kickoff", heldAt: "2026-07-18T08:55:00Z", minutes: 30 },
    presentation,
    untitled,
  ).cells.find((c) => c.id === "heldAt")!;
  assert.equal(cell.value, "5 minutes ago");
  assert.equal(cell.spoken, "Jul 18, 2026, 08:55 AM");
});

test("a row's own line honours what the field said about rows, and the record still reads it", () => {
  const hidden = fieldSays("body", { visibility: "hidden" });
  assert.equal(listRow(hidden, task, presentation, untitled).summary, undefined);
  const shown = fieldSays("body", { visibility: "shown" });
  assert.equal(listRow(shown, task, presentation, untitled).summary, task.body);
  // A paragraph kept for the record reaches the record and no row — which is the
  // same answer given from both sides of the same declaration.
  const detail = fieldSays("body", { visibility: "detail" });
  const row = listRow(detail, task, presentation, untitled);
  assert.equal(row.summary, undefined);
  assert.equal(
    row.cells.some((c) => c.id === "body"),
    false,
  );
  assert.equal(recordHeader(detail, task, presentation, untitled).summary, undefined);
  // It reaches the record the way a `detail` field always does: as one of its rows.
  assert.ok(
    recordInformation(detail, task, presentation).some(
      (item) => item.field.name === "body" && item.value === task.body,
    ),
    "the paragraph a row had no room for is still the record's own answer",
  );
});

test("a row and a record colour the same state the same way", () => {
  for (const value of ["open", "done"]) {
    const entry = hintEntry();
    const row = listRow(entry, { id: "1", title: "x", status: value }, presentation, untitled);
    const header = recordHeader(
      entry,
      { id: "1", title: "x", status: value },
      presentation,
      untitled,
    );
    assert.deepEqual(
      row.status && { label: row.status.label, tone: row.status.tone },
      header.status,
    );
  }
});

test("a row a person reads in Portuguese says its state in Portuguese", () => {
  const pt = { ...presentation, copy: deriveCopy("pt") };
  const entry = hintEntry((e) => {
    const f = (e.fields as Record<string, unknown>[]).find((x) => x.name === "status")!;
    f.presentation = { enumLabels: { open: "Em aberto" } };
  });
  assert.equal(
    listRow(entry, { id: "1", title: "x", status: "open" }, pt, pt.copy.kit.untitled).status?.label,
    "Em aberto",
  );
});

// The row's two summary values are drawn by `Value`, which needs the field and nothing
// else: a `shape` tag in the model would be a second `Value` nobody maintains.
test("every cell names the field behind it, in the words that field's author wrote", () => {
  // An entry that declares a state and names two more values in its summary: what a
  // cell is, and what it is called, are decided here and nowhere else — the author's
  // word where the author wrote one, the field's own name read as words where nobody
  // did, and the state the row already wears as its pill nowhere among them.
  const entry = hintEntry((e) => {
    e.presentation = { ...(e.presentation as object), summaryFields: ["pinned", "tags"] };
    const f = (e.fields as Record<string, unknown>[]).find((x) => x.name === "pinned")!;
    f.presentation = { label: "Stuck on" };
  });
  const row = listRow(entry, { ...task, tags: ["locksmith", "front"] }, presentation, untitled);
  assert.deepEqual(
    row.cells.map((c) => c.id),
    ["pinned", "tags"],
  );
  for (const cell of row.cells)
    assert.equal(
      cell.field?.name,
      cell.id,
      "the molecule that draws a value gets the schema behind it, not a description of it",
    );
  assert.equal(
    row.cells[0]?.label,
    "Stuck on",
    "the word the author wrote for the field, not the kit's own reading of its name",
  );
  assert.equal(row.cells[1]?.label, "Tags", "a field nobody labelled reads as its own name");
});
