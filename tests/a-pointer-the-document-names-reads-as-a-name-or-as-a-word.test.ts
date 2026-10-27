// A value that points at another record is never read back as the identifier
// stored for it. It is the other record's name when this screen resolved one,
// and one word saying that there is one when it did not — in the record's
// overview, in Record information, in a row's cells and in the words a row is
// called by. Which word depends on what the value points at, never on whether a
// read answered. A field with no declared target keeps its identifier and its
// monospaced shape: `id` is still an identifier.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { unresolved } from "./fakes/unresolved";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import {
  display,
  listRow,
  nameKey,
  points,
  pointerTargets,
  recordInformation,
  recordSections,
  referencedName,
  controlPointers,
  formControls,
  values,
  label,
} from "../src/core/derive";
import { feedback } from "./fakes/presentation";

const ID = "3f2a8c1d-4b5e-4a6b-9c8d-1e2f3a4b5c6d";

/**
 * served is the pinned golden with one field of the note turned into a pointer at
 * a person and one at a place, exactly as the kernel spells a reference — the
 * declared target, the picker widget, and, for the assignee, a frozen field.
 */
/** declared is the same record with a row that says which pointer it draws. */
function declared(): Entry {
  const doc = unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
  doc.resources[0].presentation = { summaryFields: ["siteId"] };
  mutate(doc);
  const resources = parseCatalog(doc).resources;
  return resources.find((r) => r.entity === "note")!;
}

/** mutate adds the two pointers to one golden's note, as the kernel spells them. */
function mutate(doc: Record<string, unknown>) {
  const entry = (doc.resources as Record<string, unknown>[])[0]!;
  entry.fields = [
    ...(entry.fields as Record<string, unknown>[]),
    {
      name: "assigneeId",
      type: "uuid",
      widget: "entity-picker",
      doc: "Who is dealing with it",
      presentation: { label: "Assign", visibility: "detail", reference: { resource: "user/user" } },
    },
    {
      name: "siteId",
      type: "uuid",
      doc: "Where it belongs",
      presentation: { reference: { resource: "site/site" } },
    },
  ];
}

function served(immutable: boolean): { readonly entry: Entry; readonly lines: readonly string[] } {
  const doc = unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
  if (immutable) doc.resources[0].immutable = ["status", "assigneeId"];
  const lines: string[] = [];
  mutate(doc);
  const catalog = parseCatalog(doc, (at, why) => lines.push(`${at} ${why}`));
  return { entry: catalog.resources.find((r) => r.entity === "note")!, lines };
}

const row: Record<string, string> = {
  id: ID,
  title: "Replace the gasket",
  assigneeId: ID,
  siteId: ID,
};

const named = {
  [nameKey("user/user", ID)]: "Ada Lovelace",
  [nameKey("site/site", ID)]: "North Yard",
};

test("a pointer reads as the name of the record it points at, in every medium", () => {
  const { entry, lines } = served(false);
  assert.deepEqual(lines, []);
  const assignee = entry.fields.find((f) => f.name === "assigneeId")!;
  assert.equal(points(assignee), true);
  assert.equal(display(assignee, row.assigneeId, feedback, named), "Ada Lovelace");
  const item = recordSections(entry, row, feedback, named)
    .flatMap((b) => b.items)
    .find((i) => i.field.name === "siteId");
  assert.equal(item?.value, "North Yard", "the overview names the record, not the store");
  const information = recordInformation(entry, row, feedback, named);
  assert.equal(
    information.find((i) => i.field.name === "assigneeId")?.value,
    "Ada Lovelace",
    "a detail field drawn in Record information reads as its name",
  );
  const line = listRow(declared(), row, feedback, feedback.copy.kit.untitled, named);
  assert.deepEqual(
    line.cells.map((c) => c.value),
    ["North Yard"],
    "a row's cell names the record it points at",
  );
});

test("a pointer with no name resolved says one word, by what it points at, and never the identifier", () => {
  const { entry } = served(false);
  const assignee = entry.fields.find((f) => f.name === "assigneeId")!;
  const site = entry.fields.find((f) => f.name === "siteId")!;
  assert.equal(display(assignee, row.assigneeId, feedback), feedback.copy.kit.referenceAssigned);
  assert.equal(display(site, row.siteId, feedback), feedback.copy.kit.referenceLinked);
  // A name this screen could not read is the same fact to the person reading the
  // row whether the read failed, was refused, or was never attempted.
  assert.equal(
    display(assignee, row.assigneeId, feedback, {}),
    feedback.copy.kit.referenceAssigned,
  );
  for (const shown of [
    display(assignee, row.assigneeId, feedback),
    display(site, row.siteId, feedback, named),
  ])
    assert.ok(!shown.includes(ID), shown);
});

test("a pointer with nothing in it is no fact at all, and a plain identifier keeps its shape", () => {
  const { entry } = served(false);
  const assignee = entry.fields.find((f) => f.name === "assigneeId")!;
  const id = entry.fields.find((f) => f.name === "id")!;
  assert.equal(display(assignee, undefined, feedback, named), "—");
  assert.equal(points(id), false);
  assert.equal(display(id, ID, feedback), ID, "the record's own id is still an identifier");
  assert.equal(
    label(entry, { title: "", assigneeId: ID }, () => "x", "row"),
    "x",
  );
});

test("a record called by a pointer is called by the name of what it points at", () => {
  const doc = unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
  const entry = doc.resources[0];
  entry.presentation = { primaryField: "assigneeId" };
  entry.fields.push({
    name: "assigneeId",
    type: "uuid",
    presentation: { reference: { resource: "user/user" } },
  });
  const parsed: Entry = parseCatalog(doc).resources[0]!;
  const row: Record<string, string> = { title: "Replace the gasket", assigneeId: ID };
  assert.equal(label(parsed, row, feedback.copy.kit.untitled, "row", named), "Ada Lovelace");
  assert.match(
    label(parsed, row, feedback.copy.kit.untitled, "row"),
    /^Untitled/,
    "with no name resolved the row is untitled rather than called “Linked”",
  );
});

test("a greyed reference row reads as a name and sends what the record was given", () => {
  const { entry } = served(true);
  const controls = formControls(entry, row, false, named);
  const assignee = controls.find((c) => c.field.name === "assigneeId")!;
  assert.equal(assignee.readOnly, true);
  assert.equal(assignee.value, "Ada Lovelace", "the box draws the person, not the store");
  const body = values(
    controls.map((c) =>
      c.readOnly && c.field.name in row ? { ...c, echo: row[c.field.name] } : c,
    ),
    {},
  );
  assert.equal(body.assigneeId, ID, "the write sends the identifier it was given");
  // The sheet asks only for the records its greyed boxes point at.
  assert.deepEqual(
    controlPointers(controls, row),
    [{ resource: "user/user", id: ID }],
    "an editable box holds what it must send and is never asked about",
  );
});

test("a screen asks for the records the medium it draws points at", () => {
  const { entry } = served(false);
  const asked = (where: "record" | "row", e = entry, rows = [row]) =>
    pointerTargets(e, rows, where)
      .map((p) => `${p.resource}|${p.id}`)
      .sort();
  assert.deepEqual(asked("record"), [nameKey("site/site", ID), nameKey("user/user", ID)]);
  // A row asks only for what a row draws: this entry names its two pointers, and
  // a row that names none asks for nothing.
  assert.deepEqual(asked("row", declared()), [nameKey("site/site", ID)]);
  // A row that names no cells asks for nothing: the assignee is a `detail` field
  // no row draws, and the site is one of the two cells a row ranks differently.
  assert.deepEqual(asked("row", served(false).entry), []);
  assert.deepEqual(asked("record", entry, []), []);
  const other = { ...row, assigneeId: "aaaaaaaa-0000-4000-8000-000000000000" };
  assert.deepEqual(
    pointerTargets(entry, [row, other, row], "record")
      .filter((p) => p.resource === "user/user")
      .map((p) => p.id),
    [ID, other.assigneeId],
    "a window asks once per distinct record, not once per row",
  );
});

test("a referenced record is named by the chain that names every record", () => {
  const doc = unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
  doc.resources[0].presentation = { primaryField: "title" };
  const entry: Entry = parseCatalog(doc).resources[0]!;
  assert.equal(referencedName(entry, { title: "Replace the gasket" }), "Replace the gasket");
  assert.equal(referencedName(entry, { title: "" }), "", "nothing to read is nameless");
});
