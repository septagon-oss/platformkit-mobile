// A catalog can name any field as its state. Removing that field from the summary
// leaves two slots for other facts, in declared order, without removing an unrelated
// enum just because it happens to be called status.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { listCells, listRow } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

test("a declared state leaves two summary slots for other facts wherever its name occurs", () => {
  for (let position = 0; position <= 3; position++) {
    const doc = JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
    const resource = doc.resources[0];
    resource.fields.push({ name: "phase", type: "string", enum: ["waiting", "ready"] });
    const summary = ["status", "pinned", "rank"];
    summary.splice(position, 0, "phase");
    resource.presentation = { statusField: "phase", summaryFields: summary };
    const entry = parseCatalog(doc).resources[0]!;
    const row = listRow(
      entry,
      { id: "1", title: "Check the latch", phase: "ready", status: "open", pinned: false, rank: 0 },
      presentation,
      presentation.copy.kit.untitled,
    );
    assert.equal(row.status?.label, "Ready");
    assert.deepEqual(
      listCells(entry).map((field) => field.name),
      ["status", "pinned"],
    );
    assert.deepEqual(
      row.cells.map((cell) => cell.id),
      ["status", "pinned"],
    );
    assert.equal(row.cells[1]?.raw, false);
  }
});
