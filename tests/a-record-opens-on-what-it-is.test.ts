// A record opens on what it is, not on how it is stored (0085). The whole of the
// hierarchy is one pure function of the entry and the row — `recordHeader`,
// `recordSections`, `recordInformation` — so every case below is served bytes
// through the shipped `parseCatalog`, a row, and the answer the core gives: no
// screen, no renderer, and no fixture that is not a document a server printed.
//
// The order the three answers share is the rule they are all built from: a fact is
// drawn once, at the highest place that draws it — the title, then the status pill,
// then the one summary line, then the overview blocks, then the collapsed Record
// information. What a higher place drew is not a row anywhere below it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import {
  hasValue,
  recordHeader,
  recordInformation,
  recordSections,
  rowCommands,
  commandOf,
  type DetailItem,
  type Row,
} from "../src/core/derive";
import { feedback } from "./fakes/presentation";

process.env.TZ = "UTC";

const bytes = (name: string) =>
  JSON.parse(readFileSync(new URL(`../testdata/${name}`, import.meta.url).pathname, "utf8"));

/** hintedTask is T-0328's served hinted document, with two fields put where this screen reads them. */
function hinted(mutate: (resource: Record<string, unknown>) => void = () => undefined): Entry {
  const doc = bytes("catalog.hints.json");
  mutate(doc.resources[0]);
  return parseCatalog(doc, (at, why) => {
    assert.fail(`${at}: ${why}`);
  }).resources[0]!;
}

/**
 * filed puts `pinned` in the declared `details` block and keeps `tags` for the
 * record alone. The served fixture declares sections but files only title, body and
 * status: a record whose every field names no block would prove the grouping of
 * nothing, so the two mutations are the shape the contract describes and the bytes
 * of the document this repository owns.
 */
const filed = (r: Record<string, unknown>) => {
  const fields = r.fields as Record<string, unknown>[];
  fields.find((f) => f.name === "pinned")!.presentation = { section: "details" };
  fields.find((f) => f.name === "tags")!.presentation = { visibility: "detail" };
};

const taskRow: Row = {
  id: "9f0c1b2a-0000-4000-8000-0000000000c2",
  title: "Renew the shared drive licence",
  body: "The licence expires on Friday.",
  status: "open",
  rank: 7,
  pinned: false,
  tags: ["billing", "ops"],
  createdAt: "2026-07-17T10:20:30Z",
  updatedAt: "2026-07-18T08:55:00Z",
};

const untitled = feedback.copy.kit.untitled;

/** everyRow is what a person is shown in either place, which is what "nowhere" denies. */
function everyRow(e: Entry, row: Row): readonly DetailItem[] {
  return [
    ...recordSections(e, row, feedback).flatMap((block) => block.items),
    ...recordInformation(e, row, feedback),
  ];
}

test("a fully populated record opens on its name, its state and one line", () => {
  const entry = hinted(filed);
  assert.deepEqual(recordHeader(entry, taskRow, feedback, untitled), {
    title: "Renew the shared drive licence",
    // The declared Portuguese label wins over the humanised value, which is the
    // contract; the tone is the declared one, cast into the colours this kit draws.
    status: { label: "Em aberto", tone: "warning" },
    summary: "The licence expires on Friday.",
  });
});

test("a field the header drew is not a row under it, block declared or not", () => {
  const blocks = recordSections(hinted(filed), taskRow, feedback);
  // `Content` holds only the title and the paragraph, both drawn above; the record
  // that draws no empty block is the one that does not ask a person to scroll past it.
  assert.deepEqual(
    blocks.map((b) => [b.key, b.label, b.items.map((i) => i.field.name)]),
    [["details", "Details", ["pinned"]]],
  );
});

test("a false boolean and a zero are facts and keep their row", () => {
  const blocks = recordSections(hinted(filed), taskRow, feedback);
  const pinned = blocks[0]!.items[0]!;
  assert.equal(pinned.field.name, "pinned");
  assert.equal(pinned.label, "Pinned");
  assert.equal(pinned.value, "No", "the record says no, which is a fact and not a gap");
  const ranked = hinted(filed);
  assert.equal(
    everyRow(ranked, { ...taskRow, rank: 0, pinned: true }).some(
      (i) => i.field.name === "pinned" && i.value === "Yes",
    ),
    true,
  );
});

test("integration plumbing is drawn nowhere, and its name with it", () => {
  const entry = hinted(filed);
  assert.equal(
    everyRow(entry, taskRow).some((i) => i.field.name === "rank"),
    false,
    "`rank` is visibility:hidden: its value stays in the JSON and the PATCH",
  );
  assert.equal(
    JSON.stringify([
      recordSections(entry, taskRow, feedback),
      recordInformation(entry, taskRow, feedback),
    ]).includes("Order among the records"),
    false,
    "and its help line reaches no caption either",
  );
});

test("the identifier, the two stamps and the record's own fields wait in Record information", () => {
  const entry = hinted(filed);
  assert.deepEqual(
    recordInformation(entry, taskRow, feedback).map((i) => i.field.name),
    ["id", "createdAt", "updatedAt", "tags"],
  );
  assert.deepEqual(
    recordInformation(entry, taskRow, feedback)
      .slice(0, 3)
      .map((i) => i.label),
    ["Id", "Created at", "Updated at"],
    "the author's word for each, which is the vocabulary the catalogue already uses",
  );
  assert.equal(recordInformation(entry, taskRow, feedback)[2]!.value, "5 minutes ago");
  assert.equal(
    recordInformation(entry, taskRow, feedback)[2]!.spoken,
    "Jul 18, 2026, 08:55 AM",
    "the eye is shown the distance, the reader is told the instant",
  );
});

test("a field that names no block lands in the overview, after the declared ones", () => {
  // The same document with `tags` left unfiled: the parser says such a field "stays
  // in the overview", and the overview is the block that comes last.
  const entry = hinted((r) => {
    const fields = r.fields as Record<string, unknown>[];
    fields.find((f) => f.name === "pinned")!.presentation = { section: "details" };
  });
  assert.deepEqual(
    recordSections(entry, taskRow, feedback).map((b) => [
      b.label,
      b.items.map((i) => i.field.name),
    ]),
    [
      ["Details", ["pinned"]],
      ["Overview", ["tags"]],
    ],
  );
  assert.deepEqual(
    recordInformation(entry, taskRow, feedback).map((i) => i.field.name),
    ["id", "createdAt", "updatedAt"],
    "and nothing from the overview moved down with it",
  );
});

test("an un-hinted entry gets a title, no pill, and one flat overview", () => {
  const parsed = parseCatalog(bytes("catalog.json")).resources[0]!;
  const row = {
    id: "1",
    title: "Buy milk",
    body: "Two litres",
    status: "open",
    rank: 2,
    pinned: true,
    tags: ["a", "b"],
    createdAt: "2026-09-05T10:20:30.123456Z",
  };
  assert.equal("hints" in parsed, false, "the pinned document declares nothing");
  const header = recordHeader(parsed, row, feedback, untitled);
  assert.equal(header.title, "Buy milk");
  assert.equal("status" in header, false, "no status is inferred from the first enum");
  assert.equal(header.summary, "Two litres");
  assert.deepEqual(
    recordSections(parsed, row, feedback).map((b) => b.items.map((i) => i.field.name)),
    [["status", "rank", "pinned", "tags"]],
  );
  assert.deepEqual(
    recordInformation(parsed, row, feedback).map((i) => i.field.name),
    ["id", "createdAt"],
    "a resource that answers no updatedAt shows no row for it",
  );
});

test("a record with nothing to say draws no overview rather than a dash", () => {
  const entry = hinted(filed);
  assert.deepEqual(recordSections(entry, { id: "1" }, feedback), []);
  assert.deepEqual(recordHeader(entry, { id: "1" }, feedback, untitled), {
    title: "Untitled Note",
  });
});

test("a command the catalogue marks system is never a choice, and an address still resolves", () => {
  const entry = hinted();
  assert.deepEqual(
    rowCommands(entry).map((c) => c.verb),
    [],
    "publish is a background job; archive is about the collection",
  );
  assert.equal(
    commandOf(entry, "publish", "record")?.verb,
    "publish",
    "somebody already holding the address still reaches it — the kernel guards that door",
  );
});

test("what counts as a value is decided once, and false and zero are values", () => {
  const entry = parseCatalog(bytes("catalog.json")).resources[0]!;
  const field = (name: string) => entry.fields.find((f) => f.name === name)!;
  assert.equal(hasValue(field("pinned"), false), true, "a switch answered no");
  assert.equal(hasValue(field("pinned"), true), true);
  assert.equal(hasValue(field("pinned"), undefined), false, "a switch nobody answered");
  assert.equal(hasValue(field("pinned"), "false"), false, "and a value that is not one");
  assert.equal(hasValue(field("rank"), 0), true);
  assert.equal(hasValue(field("title"), ""), false);
  assert.equal(hasValue(field("title"), null), false);
  assert.equal(hasValue(field("tags"), []), false, "an empty list says nothing");
  assert.equal(hasValue(field("tags"), ["a"]), true);
});
