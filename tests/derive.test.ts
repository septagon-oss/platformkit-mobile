import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import {
  detailItems,
  display,
  formControls,
  humanize,
  known,
  label,
  listColumns,
  screenPath,
  values,
} from "../src/core/derive";

const note = parseCatalog(
  JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url), "utf8")),
).resources[0]!;
const row = {
  id: "1",
  title: "Buy milk",
  body: "Two litres",
  status: "open",
  rank: 2,
  pinned: true,
  tags: ["a", "b"],
  createdAt: "2026-09-05T10:20:30.123456Z",
};

test("humanize reads like the web shell", () => {
  assert.equal(humanize("slaDeadline"), "Sla deadline");
  assert.equal(humanize("in_progress"), "In progress");
});

test("the row is known by its first writable string", () => {
  assert.equal(known(note.fields).name, "title");
  assert.equal(label(note, row), "Buy milk");
  assert.equal(label(note, { id: "9" }), "9");
});

test("the list leads with the known field and hides what the schema hides", () => {
  const names = listColumns(note).map((f) => f.name);
  assert.equal(names[0], "title");
  assert.ok(!names.includes("body"), "hide:list");
  assert.ok(!names.includes("id"), "the id is the link, not a column");
});

test("display is the same answer as rest.Display", () => {
  const f = (name: string) => note.fields.find((x) => x.name === name)!;
  assert.equal(display(f("pinned"), true), "Yes");
  assert.equal(display(f("pinned"), undefined), "No");
  assert.equal(display(f("status"), "open"), "Open");
  assert.equal(display(f("createdAt"), row.createdAt), "2026-09-05 10:20");
  assert.equal(display(f("tags"), ["a", "b"]), "a, b");
  assert.equal(display(f("rank"), 2), "2");
  assert.equal(display(f("body"), ""), "—");
});

test("detail shows every field in schema order", () => {
  const items = detailItems(note, row);
  assert.equal(items[0]!.label, "Id");
  assert.equal(items.find((i) => i.label === "Status")!.value, "Open");
});

test("form controls derive from the schema", () => {
  const create = formControls(note, undefined, true);
  const names = create.map((c) => c.field.name);
  assert.ok(
    !names.includes("id") && !names.includes("createdAt"),
    "read-only fields are never on a form",
  );
  assert.ok(!names.includes("status"), "an immutable field is absent on create");
  assert.equal(create.find((c) => c.field.name === "body")!.kind, "textarea");
  assert.equal(create.find((c) => c.field.name === "pinned")!.kind, "switch");
  assert.equal(create.find((c) => c.field.name === "rank")!.kind, "number");
  assert.equal(create.find((c) => c.field.name === "tags")!.kind, "list");
  const edit = formControls(note, row, false);
  const status = edit.find((c) => c.field.name === "status")!;
  assert.equal(status.kind, "select");
  assert.equal(status.readOnly, true);
  assert.equal(status.value, "open");
  assert.equal(edit.find((c) => c.field.name === "pinned")!.value, "true");
});

test("values turns what a form holds back into what the API takes", () => {
  const controls = formControls(note, undefined, true);
  const out = values(controls, {
    title: "Milk",
    rank: "3",
    pinned: "true",
    tags: "a, b",
    body: "",
  });
  assert.deepEqual(out, { title: "Milk", rank: 3, pinned: true, tags: ["a", "b"] });
});

test("a screen path is module/entity", () => {
  assert.equal(screenPath(note), "/note/note");
});
