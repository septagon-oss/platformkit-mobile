// A box nobody can type into that points at another record draws that record's
// name — or the word for a pointer with no name — and the whole-row replace still
// sends the identifier the record was read with. The proof goes through
// `writeControls`, the path the sheet's own save takes, so a displayed name can
// never change what is sent, and the name is never mistaken for a value to
// validate or a change to save.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import {
  changedFields,
  formControls,
  nameKey,
  problems,
  values,
  writeControls,
  type FormWords,
} from "../src/core/derive";
import { feedback } from "./fakes/presentation";

const ID = "3f2a8c1d-4b5e-4a6b-9c8d-1e2f3a4b5c6d";

/** served is the golden's note with a frozen pointer at a person, as the kernel spells its task's assignee. */
function served(): Entry {
  const doc = JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
  const note = doc.resources[0];
  note.immutable = ["status", "assigneeId"];
  note.fields.push({
    name: "assigneeId",
    type: "uuid",
    widget: "entity-picker",
    presentation: { label: "Assignee", visibility: "detail", reference: { resource: "user/user" } },
  });
  return parseCatalog(doc).resources.find((r) => r.entity === "note")!;
}

const row: Record<string, unknown> = { id: ID, title: "Replace the gasket", assigneeId: ID };

const words: FormWords = {
  commaInValue: "comma",
  fieldRequired: (field) => `Enter ${field}.`,
  fieldChoiceRequired: (field) => `Choose ${field}.`,
  fieldNumber: "number",
  fieldTime: "time",
};

for (const [said, names] of [
  ["a resolved name", { [nameKey("user/user", ID)]: "Ada Lovelace" }],
  [
    "the word for a pointer nobody could name",
    { [nameKey("user/user", ID)]: feedback.copy.kit.referenceAssigned },
  ],
] as const) {
  test(`a greyed pointer box drawing ${said} sends the identifier through the sheet's own write path`, () => {
    const entry = served();
    const drawn = formControls(entry, row, false, names);
    const assignee = drawn.find((c) => c.field.name === "assigneeId")!;
    assert.equal(assignee.readOnly, true);
    assert.equal(assignee.value, names[nameKey("user/user", ID)]);
    assert.ok(!assignee.value.includes(ID), "the box never shows the identifier");
    const body = values(writeControls(entry, row, drawn), {});
    assert.equal(body.assigneeId, ID, "the PUT carries what the read returned");
    assert.deepEqual(problems(drawn, {}, words), {}, "a displayed name is not a value to validate");
    assert.deepEqual(changedFields(drawn, {}), [], "a displayed name is not a change to save");
  });
}

test("a box a person can type into keeps the identifier it must send", () => {
  const doc = JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
  doc.resources[0].fields.push({
    name: "assigneeId",
    type: "uuid",
    widget: "entity-picker",
    presentation: { reference: { resource: "user/user" } },
  });
  const entry: Entry = parseCatalog(doc).resources.find((r) => r.entity === "note")!;
  const names = { [nameKey("user/user", ID)]: "Ada Lovelace" };
  const assignee = formControls(entry, row, false, names).find(
    (c) => c.field.name === "assigneeId",
  )!;
  assert.equal(assignee.readOnly, false);
  assert.equal(assignee.value, ID, "what is in the box is what will be sent");
});
