// One rule, read at the screens it reaches: a field its author kept off a screen
// is neither drawn nor named on that screen. `visibility` decides which columns a
// list has, so it decides the field the list leads with, the words a row is called
// by, the line under those words and the cells beside them — declared pointers
// included, which is why `previewField` and `summaryFields` are asked here too;
// `hidden` is off the record's own screen too, where `hideList` asks nothing, while
// `detail` stays on it as the record's name and its state; and a declared pointer
// at plumbing (`primaryField`, `previewField`, `summaryFields`, `statusField`) names
// nothing and lets the documented default read on. The reference kernel refuses
// such a pointer at mount (`kit/rest/hints.go`, `namedFieldFault`: "a row is not
// named by its plumbing"); the phone keeps every screen and refuses the pointer.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Entry } from "../src/core/catalog";
import { parseCatalog } from "../src/core/catalog";
import { deriveCatalogList } from "../src/core/catalogList";
import {
  detailItems,
  listCells,
  listPreview,
  label,
  noOrder,
  primary,
  rowPrimary,
  statusField,
  type Row,
} from "../src/core/derive";
import { presentation } from "./fakes/presentation";

const untitled = presentation.copy.kit.untitled;
const secret = "Integration-only identity";

const golden = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8"));

/** noteWith declares one field's hint and any entry hint, and answers the entry the phone reads. */
function noteWith(
  field: string,
  fieldHint: Record<string, unknown>,
  entryHint: Record<string, unknown> = {},
): Entry {
  const doc = golden();
  const target = (doc.resources[0].fields as Record<string, unknown>[]).find(
    (f) => f.name === field,
  )!;
  target.presentation = fieldHint;
  doc.resources[0].presentation = entryHint;
  return parseCatalog(doc).resources[0]!;
}

const rowOf = (over: Row): Row => ({
  id: "1",
  title: secret,
  body: "Two paragraphs",
  status: "open",
  rank: 3,
  pinned: true,
  tags: [],
  createdAt: "2026-07-17T09:00:00Z",
  updatedAt: "2026-07-18T09:00:00Z",
  ...over,
});

/** firstRow is the list screen's own answer for one record: its title, its line, its cells. */
function firstRow(entry: Entry, row: Row) {
  const derived = deriveCatalogList(
    {
      entry,
      rows: [row],
      total: 1,
      loading: false,
      refreshing: false,
      more: false,
      error: "",
      order: noOrder,
      ordering: false,
      canCreate: true,
    },
    presentation,
  );
  assert.equal(derived.ok, true, JSON.stringify(derived));
  if (!derived.ok) throw new Error("unreachable");
  return derived.value.sections[0]!.rows[0]!;
}

test("a row is titled, lined and filled only with fields a row has", () => {
  for (const visibility of ["hidden", "detail"]) {
    const entry = noteWith("title", { visibility });
    const row = firstRow(entry, rowOf({}));
    // The note holds no other readable non-enum string, so nothing else can name it.
    assert.equal(rowPrimary(entry), undefined, `${visibility} names no row`);
    assert.equal(row.title, untitled("Note"), `${visibility} titles the record it kept off a row`);
    assert.equal(
      JSON.stringify(row).includes(secret),
      false,
      `${visibility} keeps its value off the row entirely, not off the column list`,
    );
  }
});

test("a declared pointer at plumbing names nothing and lets the default read on", () => {
  const named = noteWith("title", { visibility: "hidden" }, { primaryField: "title" });
  assert.equal(primary(named), undefined, "the record is not titled by its plumbing either");
  assert.equal(rowPrimary(named), undefined);

  const flat = noteWith("body", { visibility: "hidden" }, { previewField: "body" });
  assert.equal(listPreview(flat), undefined, "a hidden paragraph is not a row's summary line");
  assert.equal(
    listPreview(noteWith("body", { visibility: "hidden" }))?.name,
    undefined,
    "and the default never reaches for one either",
  );

  const cells = noteWith("rank", { visibility: "hidden" }, { summaryFields: ["status", "rank"] });
  assert.deepEqual(
    listCells(cells).map((f) => f.name),
    ["status"],
    "a declared cell list loses the field no screen draws, and keeps the author's order",
  );

  const pill = noteWith("rank", { visibility: "hidden" }, { statusField: "rank" });
  assert.equal(statusField(pill), undefined, "plumbing is no record's state");
});

test("a detail field stays the record's own name and the record's own state", () => {
  const named = noteWith("title", { visibility: "detail" });
  assert.equal(primary(named)?.name, "title", "the record answers what a row has no room for");
  assert.equal(label(named, rowOf({}), untitled), secret, "and calls itself by it");
  const pill = noteWith("status", { visibility: "detail" }, { statusField: "status" });
  assert.equal(statusField(pill)?.name, "status", "a detail set of values is still a state");
});

test("a hidden field is off the record's own screen, where hideList asks nothing", () => {
  const shown = noteWith("body", { visibility: "detail" });
  assert.ok(
    detailItems(shown, { id: "1", body: "Two paragraphs" }, presentation).some(
      (i) => i.field.name === "body",
    ),
    "detail is the record's answer, so the record answers it",
  );
  const hidden = noteWith("rank", { visibility: "hidden" });
  assert.ok(
    !detailItems(hidden, { id: "1", rank: 3 }, presentation).some((i) => i.field.name === "rank"),
    "hidden is plumbing, and the record is not built from plumbing",
  );
  assert.ok(
    detailItems(noteWith("rank", { visibility: "shown" }), { id: "1", rank: 3 }, presentation).some(
      (i) => i.field.name === "rank",
    ),
    "shown is the author taking the field back, on every screen",
  );
});
