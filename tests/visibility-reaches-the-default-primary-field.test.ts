// A declared visibility reaches the default primary chain. The kernel pins this
// for the web shell (`ui/resource/primary_visibility_test.go`,
// TestListVisibilityAlsoAppliesToTheDefaultPrimaryField at the pinned commit), and
// `derive.ts`'s header promises the two shells agree. The mount gate refuses only
// a declared *pointer* at a hidden field (`kit/rest/hints.go` namedFieldFault), so
// a catalogue in which `title` itself is declared `hidden` or `detail` is one a
// reference kernel serves — and a field the author kept off every screen is not
// the field a row is named by.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { deriveCopy, label, listColumns, primary } from "../src/core/derive";

const golden = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8"));
const untitled = deriveCopy("en").kit.untitled;

function noteWith(visibility: string) {
  const doc = golden();
  const title = (doc.resources[0].fields as Record<string, unknown>[]).find(
    (f) => f.name === "title",
  )!;
  title.presentation = { visibility };
  return parseCatalog(doc).resources[0]!;
}

test("a field declared hidden never names a row", () => {
  const entry = noteWith("hidden");
  const row = { id: "1", title: "Integration-only identity", status: "open" };
  // The note schema holds no other readable non-enum string, so the chain ends
  // and the row reads as the record it is, in the reader's words.
  assert.equal(primary(entry), undefined);
  assert.equal(label(entry, row, untitled), "Untitled Note");
  assert.deepEqual(
    listColumns(entry).map((f) => f.name),
    ["createdAt", "updatedAt", "status", "rank", "pinned", "tags"],
    "a hidden field is off the list, leading column included",
  );
});

test("a field declared detail does not lead the list", () => {
  const entry = noteWith("detail");
  // `detail` is the record's field, not the list's: whatever titles the record,
  // the list's columns are the fields the author left on a row.
  assert.deepEqual(
    listColumns(entry).map((f) => f.name),
    ["createdAt", "updatedAt", "status", "rank", "pinned", "tags"],
    "a detail field gives up the column, the leading one included",
  );
});
