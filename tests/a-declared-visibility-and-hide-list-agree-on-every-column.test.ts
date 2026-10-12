// A list's columns answer one question of a field, however the two tags combine:
// a declared visibility wins over `hideList` both ways (`shown` reclaims the
// column `hideList` took; `detail` and `hidden` give up one it left), and a field
// that declares nothing keeps the schema's older answer. The kernel states the
// same precedence once (`kit/entity.Field.OnList`); this is that rule read on the
// phone, pinned cell by cell so a rewrite of the boolean cannot move one corner
// of the table without saying so.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { onList } from "../src/core/derive";

const golden = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8"));

/** noteField reads one field of the golden note back with the tags this case sets. */
function noteField(hideList: boolean | undefined, visibility: string | undefined) {
  const doc = golden();
  const field = (doc.resources[0].fields as Record<string, unknown>[]).find(
    (f) => f.name === "status",
  )!;
  if (hideList === undefined) delete field.hideList;
  else field.hideList = hideList;
  if (visibility === undefined) delete field.presentation;
  else field.presentation = { visibility };
  const entry = parseCatalog(doc, (path, reason) => {
    assert.fail(`${path}: ${reason}`);
  }).resources[0]!;
  return entry.fields.find((f) => f.name === "status")!;
}

test("a declared visibility and hideList agree on every column", () => {
  const table: readonly [boolean | undefined, string | undefined, boolean][] = [
    [undefined, undefined, true], // the schema says nothing, so the column stays
    [true, undefined, false], // hideList alone still hides
    [undefined, "shown", true],
    [true, "shown", true], // shown reclaims the column hideList took
    [undefined, "detail", false], // the record's answer, which a row has no room for
    [true, "detail", false],
    [undefined, "hidden", false], // plumbing is nobody's column
    [true, "hidden", false],
  ];
  for (const [hideList, visibility, column] of table) {
    assert.equal(
      onList(noteField(hideList, visibility)),
      column,
      `hideList ${String(hideList)} with visibility ${String(visibility)}`,
    );
  }
});
