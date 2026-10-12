// A whole-row replace carries what nobody typed exactly as the read returned it. The
// body builder is `writeControls`, and two of its promises have no case of their own:
// a frozen field it hands back is still greyed — `readOnly` stays true, so whoever draws
// that list draws a disabled box, never an editable one mislabelled — and a hidden
// field the row answered with an empty string travels as that empty string, because a
// PUT that leaves it out is a PUT that clears it. Both are served through the shipped
// `parseCatalog`, with the one mutation each case needs named where it is used.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import { formControls, values, writeControls } from "../src/core/derive";

/** note is the served catalogue's first resource, which already freezes `status`. */
function noteEntry(mutate: (resource: Record<string, unknown>) => void = () => undefined): Entry {
  const doc = JSON.parse(
    readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8"),
  );
  mutate(doc.resources[0]);
  return parseCatalog(doc).resources[0]!;
}

/** hidden keeps a field in the schema and the JSON and takes it off the sheet. */
const hidden = (name: string) => (resource: Record<string, unknown>) => {
  const field = (resource.fields as Record<string, unknown>[]).find((f) => f.name === name)!;
  field.presentation = {
    ...(field.presentation as object | undefined),
    visibility: "hidden",
  } as Record<string, unknown>;
};

test("a frozen field the body carries is still greyed, and carries the row's own value", () => {
  const entry = noteEntry();
  assert.ok(entry.immutable.includes("status"), "the served note freezes status");
  const row = { id: "1", title: "Buy milk", status: "open", rank: 2 };
  const sheet = formControls(entry, row, false);
  assert.ok(sheet.find((c) => c.field.name === "status")!.readOnly, "the sheet greys it");

  const body = writeControls(entry, row, sheet);
  const status = body.find((c) => c.field.name === "status")!;
  assert.equal(status.readOnly, true, "the body builder keeps it greyed");
  assert.equal(status.echo, "open");
  // Only what nobody may type is echoed: a box the person can answer carries none.
  assert.equal(body.find((c) => c.field.name === "title")!.echo, undefined);
  assert.equal(body.find((c) => c.field.name === "rank")!.echo, undefined);
  // And the echo is what the PUT sends, greyed or not.
  assert.equal(values(body, { title: "New title" }).status, "open");
});

test("a hidden field the row answered with nothing travels as nothing, not as an absence", () => {
  const entry = noteEntry(hidden("body"));
  const row = { id: "1", title: "Buy milk", status: "open", body: "" };
  const sheet = formControls(entry, row, false);
  assert.ok(!sheet.some((c) => c.field.name === "body"), "a hidden field is not drawn");

  const sent = values(writeControls(entry, row, sheet), { title: "New title" });
  assert.ok("body" in sent, "a field the read returned is a field the PUT carries");
  assert.equal(sent.body, "");
  assert.equal(sent.title, "New title");
});
