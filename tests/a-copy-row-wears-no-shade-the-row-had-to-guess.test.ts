// Rules this file holds about one row of a person's copies when the row says nothing.
// Shading a copy is a declaration read against a value, never a guess: a served row that
// prints no availability at all — the field absent, or present and empty of an answer — is
// the ordinary row this entry always drew, with its own preview line under its name. And the
// shade costs a copy nothing it had: the same name, the same cells and the same state pill,
// so the person can still open the copy and still take it away.
import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import { listRow, type Row } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

const untitled = presentation.copy.kit.untitled;
const kit = presentation.copy.kit;

/**
 * library is a savable source and the entry holding this person's copies of it.
 *
 * `holder` is what the holding entry declares: the availability pointer is what alone may
 * shade a row, and `previewField` is the entry's own line, which a copy whose source is
 * there keeps and a copy whose source went trades for the kit's sentence.
 */
function library(holder: Record<string, unknown> = { availabilityField: "availability" }) {
  const notices: string[] = [];
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
            { name: "season", type: "string" },
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
    (at, why) => notices.push(`${at} ${why}`),
  );
  assert.deepEqual(notices, [], "the mounted catalogue says nothing about itself");
  return catalog.resources[1]! as Entry;
}

/** line is one served copy read as the row a list draws. */
const line = (e: Entry, row: Row) => listRow(e, row, presentation, untitled);
const copy = (answered: Record<string, unknown> = { availability: "available" }): Row => ({
  id: "c-1",
  title: "The look I kept",
  note: "From the spring window",
  season: "Spring",
  revision: 1,
  ...answered,
});

test("a copy whose row prints no availability keeps its own line and wears no shade", () => {
  const copies = library();
  for (const answered of [
    {},
    { availability: undefined },
    { availability: null },
    { availability: "" },
  ]) {
    const row = line(copies, copy(answered));
    assert.equal(row.tone, undefined, `${JSON.stringify(answered)} is no answer to shade by`);
    assert.equal(
      row.summary,
      "From the spring window",
      "the entry's own line survives a row that had nothing to say about its source",
    );
  }
});

test("the grey costs a copy nothing it had", () => {
  const copies = library();
  const there = line(copies, copy({ availability: "available" }));
  const gone = line(copies, copy({ availability: "unavailable" }));
  assert.equal(gone.title, there.title, "the copy is still named by its own title");
  assert.deepEqual(gone.cells, there.cells, "the values that set this copy apart are still there");
  assert.deepEqual(gone.media, there.media, "and its picture with them");
  assert.equal(there.status, undefined, "an entry that declares no state is guessed at by nobody");
  assert.equal(gone.summary, kit.savedUnavailable, "only the line under the name changes");
});

test("nothing but the two kinds of gone shades a row, and each keeps its own sentence", () => {
  const copies = library();
  const shades = new Set(["muted", undefined]);
  for (const answered of [
    "available",
    "unavailable",
    "temporary",
    "gone",
    "",
    null,
    7,
    {},
    "TEMP",
  ]) {
    const row = line(copies, copy({ availability: answered as unknown }));
    assert.ok(shades.has(row.tone), `${JSON.stringify(answered)} invents no third shade`);
    if (row.tone === undefined) continue;
    assert.ok(
      row.summary === kit.savedUnavailable || row.summary === kit.savedTemporary,
      "the sentence is the kit's own, and one of the two",
    );
  }
  assert.notEqual(kit.savedUnavailable, kit.savedTemporary, "the two kinds of gone are two lines");
});
