// A fact is drawn once, at the highest place that draws it (0085; README "How a
// record opens": "A field that a higher place drew is not a row anywhere below
// it", and the brief: "The title is not repeated as a field"). The catalogue
// deliberately lets a `visibility: detail` field name the record — `primary`'s
// chain reads detail fields, since the record answers a detail field and a row
// has no room for it — so the rule is held on exactly that shape: a record named
// and stated by fields it keeps for itself draws them in the header and nowhere
// below, Record information included.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import { recordHeader, recordInformation, recordSections } from "../src/core/derive";
import { feedback } from "./fakes/presentation";

process.env.TZ = "UTC";

/** The served hinted document, its name and state kept for the record's own screen. */
function keptForTheRecord(): Entry {
  const doc = JSON.parse(
    readFileSync(new URL("../testdata/catalog.hints.json", import.meta.url).pathname, "utf8"),
  );
  const fields = (doc.resources[0] as { fields: Record<string, unknown>[] }).fields;
  fields.find((f) => f.name === "title")!.presentation = {
    label: "Subject",
    visibility: "detail",
  };
  (fields.find((f) => f.name === "status")!.presentation as Record<string, unknown>).visibility =
    "detail";
  return parseCatalog(doc, (at, why) => {
    assert.fail(`${at}: ${why}`);
  }).resources[0]!;
}

const row = {
  id: "9f0c1b2a-0000-4000-8000-0000000000c2",
  title: "Renew the shared drive licence",
  body: "The licence expires on Friday.",
  status: "open",
  createdAt: "2026-07-17T10:20:30Z",
  updatedAt: "2026-07-18T08:55:00Z",
};

test("a detail-visibility field the header drew is not a row inside Record information", () => {
  const entry = keptForTheRecord();
  // The header still names the record and still draws the declared pill and the
  // one line: that is the highest place, and it is where these three facts live.
  const header = recordHeader(entry, row, feedback, feedback.copy.kit.untitled);
  assert.equal(header.title, "Renew the shared drive licence");
  assert.equal(header.status?.label, "Em aberto");
  assert.equal(header.summary, "The licence expires on Friday.");
  // The overview honours the rule: nothing the header drew is a block's row.
  assert.deepEqual(
    recordSections(entry, row, feedback).flatMap((b) => b.items.map((i) => i.field.name)),
    [],
  );
  // And Record information holds the record's plumbing only — the identifier and
  // the stamps — never the name or the state the header already drew.
  assert.deepEqual(
    recordInformation(entry, row, feedback).map((i) => i.field.name),
    ["id", "createdAt", "updatedAt"],
  );
});
