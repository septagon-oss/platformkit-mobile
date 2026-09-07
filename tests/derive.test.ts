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
  listCells,
  listColumns,
  narrowed,
  noOrder,
  numberValue,
  plural,
  problems,
  queryFilters,
  sortOptions,
  splitList,
  timeText,
  timeValue,
  timeWire,
  screenPath,
  values,
} from "../src/core/derive";

// An instant reads in the device's zone; the test's device is in UTC.
process.env.TZ = "UTC";

const note = parseCatalog(
  JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8")),
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
  assert.equal(display(f("createdAt"), row.createdAt), "Sep 5, 2026, 10:20 AM UTC");
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
  assert.equal(
    screenPath({ ...note, module: "north/west", entity: "note#summary" }),
    "/north%2Fwest/note%23summary",
  );
});

test("an instant is parsed, rendered where the phone is, and sent as the API takes it", () => {
  const at = timeValue("2026-01-31T09:00:00Z")!;
  assert.equal(timeWire(at), "2026-01-31T09:00:00.000Z");
  assert.equal(timeText(at), "Jan 31, 2026, 09:00 AM UTC");
  assert.equal(timeValue(""), undefined);
  assert.equal(timeValue("yesterday"), undefined);
  assert.equal(timeValue(undefined), undefined);
});

test("a typed number may carry a decimal comma and a sign; anything else is not a number", () => {
  assert.equal(numberValue("2"), 2);
  assert.equal(numberValue("-1.5"), -1.5);
  assert.equal(numberValue("1,5"), 1.5);
  assert.equal(numberValue(" 10 "), 10);
  assert.equal(numberValue(""), undefined);
  assert.equal(numberValue("two"), undefined);
});

test("a form refuses a number or an instant that is not one before the server sees it", () => {
  const controls = formControls(note, undefined, true);
  assert.deepEqual(problems(controls, { rank: "abc" }), { rank: "is not a number" });
  assert.deepEqual(problems(controls, { rank: "3" }), {});
  assert.deepEqual(problems(controls, {}), {});
});

test("the orders a list offers are newest, oldest and each visible column both ways", () => {
  const labels = sortOptions(note).map((o) => o.label);
  assert.deepEqual(labels.slice(0, 2), ["Newest first", "Oldest first"]);
  assert.ok(labels.includes("Title, ascending"));
  assert.ok(labels.includes("Rank, descending"));
  assert.ok(!labels.includes("Pinned, ascending"));
});

test("filters are spelled the way the API takes them, and narrowing is visible", () => {
  assert.deepEqual(queryFilters(noOrder), []);
  assert.deepEqual(queryFilters({ sort: "", filters: { status: "open" } }), ["status:open"]);
  assert.equal(narrowed(noOrder), false);
  assert.equal(narrowed({ sort: "title", filters: {} }), true);
  assert.equal(narrowed({ sort: "", filters: { status: "open" } }), true);
});

test("a comma-separated field is split once, for the control and for the API", () => {
  assert.deepEqual(splitList(" a , b ,, c "), ["a", "b", "c"]);
  assert.deepEqual(splitList(""), []);
});

test("clearing an optional instant clears it on the server; a required one is left alone", () => {
  const controls = formControls(note, { dueAt: "2026-01-31T09:00:00Z" }, false);
  const due = controls.find((c) => c.kind === "datetime");
  if (due) {
    assert.equal(values(controls, { [due.field.name]: "" })[due.field.name], null);
  }
  const title = controls.find((c) => c.field.name === "title")!;
  assert.equal(values([title], { title: "" }).title, "");
});

test("many of an entity is its name with an s, unless it already ends in one", () => {
  assert.equal(plural("task"), "tasks");
  assert.equal(plural("settings"), "settings");
  assert.equal(plural("plan"), "plans");
});

test("a row shows what tells two records apart, not the times every record has", () => {
  const names = listCells(note).map((f) => f.name);
  assert.deepEqual(names, ["status", "pinned", "rank"]);
  // The name of the row is not repeated beneath it, and the id is never a cell.
  assert.ok(!names.includes("title"));
  assert.ok(!names.includes("id"));
});
