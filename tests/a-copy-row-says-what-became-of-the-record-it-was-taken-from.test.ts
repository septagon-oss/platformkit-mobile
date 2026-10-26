// Rules this file holds about one row of a person's saved copies.
// The entry that holds copies prints one field saying what its source still is, and the kit
// reads exactly that field: a copy whose source has gone wears the theme's muted ink and says
// which kind of gone it is, a copy whose provider is down says down rather than gone, and a
// copy whose source is there is an ordinary row that keeps the line the entry writes about
// itself. A value that is none of the three spellings is not read as a copy whose source went,
// and an entry that declares no such field greys nothing at all: shading is a declaration,
// never a guess about a row that answered oddly.
import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalog, type Catalog, type Entry, type HintNotice } from "../src/core/catalog";
import { listRow, type Row } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

const untitled = presentation.copy.kit.untitled;
const kit = presentation.copy.kit;

/**
 * library is a savable source and the entry holding this person's copies of it.
 *
 * `holder` is what the holding entry declares besides its fields: the availability pointer is
 * dropped here to show that a row cannot be greyed without it, and `hideList` on that field is
 * what keeps availability out of the row's own cells while the row still reads it.
 */
function library(holder: Record<string, unknown> = { availabilityField: "availability" }): {
  catalog: Catalog;
  copies: Entry;
  notices: string[];
} {
  const notices: string[] = [];
  const notice: HintNotice = (at, why) => notices.push(`${at} ${why}`);
  const catalog = parseCatalog(
    {
      catalogVersion: 3,
      resources: [
        {
          module: "look",
          entity: "product",
          path: "/api/v1/look/products",
          writable: false,
          fields: [
            { name: "id", type: "uuid", readOnly: true },
            { name: "title", type: "string" },
          ],
          commands: [],
          presentation: {
            filters: [],
            saved: {
              save: "Save",
              saved: "Saved",
              remove: "Remove",
              listEntry: "look/copy",
            },
          },
        },
        {
          module: "look",
          entity: "copy",
          path: "/api/v1/look/copies",
          writable: true,
          fields: [
            { name: "id", type: "uuid", readOnly: true },
            { name: "title", type: "string", readOnly: true },
            { name: "note", type: "string", readOnly: true },
            { name: "availability", type: "string", readOnly: true, hideList: true },
            { name: "revision", type: "int", readOnly: true, hideList: true },
          ],
          commands: [
            {
              verb: "save",
              summary: "Keep a copy",
              collection: true,
              fields: [{ name: "source", type: "string", required: true }],
            },
            {
              verb: "unsave",
              summary: "Take one copy away",
              fields: [
                { name: "id", type: "uuid", required: true },
                { name: "expectedRevision", type: "int", required: true },
              ],
            },
          ],
          presentation: { filters: [], previewField: "note", ...holder },
        },
      ],
    },
    notice,
  );
  return { catalog, copies: catalog.resources[1]!, notices };
}

/** line is one served copy read as the row a list draws. */
const line = (e: Entry, row: Row) => listRow(e, row, presentation, untitled);
const copy = (availability: unknown): Row => ({
  id: "c-1",
  title: "The look I kept",
  note: "From the spring window",
  availability,
  revision: 1,
});

test("a copy whose source has gone is greyed and says the record went", () => {
  const { copies, notices } = library();
  assert.deepEqual(notices, [], "the declared availability field costs the catalogue no notice");
  const row = line(copies, copy("unavailable"));
  assert.equal(row.tone, "muted", "the row wears the theme's muted ink");
  assert.equal(row.summary, kit.savedUnavailable, "the line says the record has gone");
});

test("a copy whose provider is down says down and not gone", () => {
  const row = line(library().copies, copy("temporary"));
  assert.equal(row.tone, "muted");
  assert.equal(row.summary, kit.savedTemporary);
  assert.notEqual(row.summary, kit.savedUnavailable, "the two kinds of gone are two sentences");
});

test("a copy whose source is there keeps the line its entry writes about itself", () => {
  const row = line(library().copies, copy("available"));
  assert.equal(row.tone, undefined, "a row that reaches its record is an ordinary row");
  assert.equal(row.summary, "From the spring window", "the entry's own preview line survives");
});

test("a field answering none of the three spellings says nothing about the source", () => {
  for (const answered of ["gone", "", null, 7, "AVAILABLE"]) {
    const row = line(library().copies, copy(answered));
    assert.equal(row.tone, undefined, `${JSON.stringify(answered)} is no availability`);
    assert.equal(row.summary, "From the spring window");
  }
});

test("an entry that declares no availability field greys no row and says nothing", () => {
  const { copies, notices } = library({});
  assert.deepEqual(notices, [], "no declaration is no defect");
  const row = line(copies, copy("unavailable"));
  assert.equal(row.tone, undefined);
  assert.equal(row.summary, "From the spring window");
});

test("an availability field naming no field of its own entry is refused by name", () => {
  const { copies, notices } = library({ availabilityField: "sourceAvailability" });
  assert.equal(copies.hints?.availabilityField, undefined, "the bad pointer is not kept");
  assert.deepEqual(notices, [
    "resources[1].presentation.availabilityField names no field of this entry: the default is used",
  ]);
  assert.equal(line(copies, copy("unavailable")).tone, undefined);
});

test("the greyed row is still the row of the copy this person kept", () => {
  const row = line(library().copies, copy("unavailable"));
  assert.equal(row.title, "The look I kept", "the copy is named by its own title");
  assert.deepEqual(
    row.cells.map((cell) => cell.id),
    [],
    "the availability field is hidden from the cells and read as the shading only",
  );
});
