// A fact is drawn once, at the place that owes it. The record already holds that rule:
// what its header drew (the primary field, the declared state, the preview) is no row
// anywhere below it. A list row owes the same answer: the declared `statusField` is the
// row's pill, in the column `Row` reserves for it, and the same value is not also one of
// the two cells beside the title — a row that says "Em aberto" as its pill and "Em
// aberto" again as a cell says one fact twice, which is the duplication 0085's row
// anatomy ("a status pill and at most two meaningful summary values") exists to retire.
// An entry that declares no state keeps its enum as a plain cell: there is no pill to
// defer to, so the cell is the one place the value is said.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import { listCells, listRow } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

const untitled = presentation.copy.kit.untitled;
const golden = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url), "utf8"));
const hinted = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.hints.json", import.meta.url), "utf8"));

const task = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Fix the door",
  body: "The front door lock sticks in the morning.",
  status: "open",
  pinned: true,
  rank: 3,
};

test("a declared state is the row's pill and not a cell beside it", () => {
  // The golden note with only a statusField declared: the derived cell ranking must
  // step past the field the pill already says, to the values that still set the row
  // apart (the yes-or-no, then the number).
  const doc = golden();
  doc.resources[0].presentation = { statusField: "status" };
  const entry = parseCatalog(doc).resources[0]!;
  const row = listRow(entry, task, presentation, untitled);
  assert.ok(row.status, "the declared state reaches the row as its pill");
  assert.equal(row.status?.label, "Open");
  assert.equal(
    row.cells.some((c) => c.id === "status"),
    false,
    "the value the pill says is not said again as a cell",
  );
  assert.ok(!listCells(entry).some((f) => f.name === "status"));
});

test("an author who points the summary at the declared state still gets the fact once", () => {
  // The hinted fixture declares both (`statusField: "status"`, `summaryFields:
  // ["status","rank"]`, rank hidden). The two declarations name one value; the pill is
  // the more specific slot, so the row carries the pill and no status cell — the same
  // precedence the record gives its header over its own rows.
  const entry: Entry = parseCatalog(hinted()).resources[0]!;
  const row = listRow(entry, task, presentation, untitled);
  assert.deepEqual(row.status, { label: "Em aberto", tone: "warning", symbol: "none" });
  assert.equal(
    row.cells.some((c) => c.id === "status"),
    false,
    "one value, one drawing: the pill already answered",
  );
});

test("an entry that declares no state keeps its closed set as a plain cell", () => {
  // No pill to defer to: the enum is the first thing that tells two records apart,
  // and the cell is the one place it is said.
  const entry = parseCatalog(golden()).resources[0]!;
  const row = listRow(entry, task, presentation, untitled);
  assert.equal(row.status, undefined);
  assert.deepEqual(
    row.cells.map((c) => c.id),
    ["status", "pinned"],
  );
});
