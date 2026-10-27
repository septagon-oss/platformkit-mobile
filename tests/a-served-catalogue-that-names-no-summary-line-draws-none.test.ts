// What the pinned server document says about a record's summary line, and what the
// record draws. `testdata/catalog.json` is the kernel's own golden at the pinned
// commit (its bytes hash to the file `ui/screens/testdata/catalog.json` prints at
// 988e95c), and every entry in it carries a `resolved` block whose
// `titles.preview` is empty: the server named no summary line for a record. An
// empty preview is an answer, so the phone draws none rather than asking its old
// heuristic for a text field to put under the title.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { listPreview, recordHeader } from "../src/core/derive";
import { feedback } from "./fakes/presentation";

const row = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  title: "Site visit",
  body: "Bring the laminator keys and the signed sheet.",
  status: "open",
  rank: 3,
  pinned: true,
  tags: ["ops"],
  createdAt: "2026-07-18T09:00:00Z",
  updatedAt: "2026-07-19T09:00:00Z",
};

test("the served catalogue names no record preview and the record draws none", () => {
  const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
  const supported = catalog.resources.filter((entry) => entry.resolved !== undefined);
  assert.ok(supported.length > 0, "the pinned document carries supported blocks");

  for (const entry of supported) {
    const named = `${entry.module}/${entry.entity}`;
    assert.equal(entry.resolved!.titles.preview, "", `${named}: the server named no preview`);
    assert.equal(listPreview(entry, "record"), undefined, `${named}: no field lines a record`);
    const header = recordHeader(entry, row, feedback, () => "Untitled");
    assert.equal(header.summary, undefined, `${named}: the record draws no summary line`);
  }
});
