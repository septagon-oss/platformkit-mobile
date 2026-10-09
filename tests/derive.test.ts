import { feedback } from "./fakes/presentation";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import {
  collectionCommands,
  commandControls,
  commandOf,
  commandScope,
  commandTitle,
  deriveCopy,
  detailItems,
  display,
  formControls,
  humanize,
  hostLabel,
  known,
  label,
  listCells,
  listColumns,
  listPreview,
  narrowed,
  rowCommands,
  noOrder,
  numberValue,
  plural,
  presentedInstant,
  problems,
  queryFilters,
  sortOptions,
  splitList,
  timeText,
  timeValue,
  timeWire,
  screenPath,
  values,
  type Formatting,
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
  // A command's verb is the word on its button: the dash is a space already.
  assert.equal(humanize("mark-paid"), "Mark paid");
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
  assert.equal(display(f("pinned"), true, feedback), "Yes");
  // A switch with no answer says there is none; only a switch answered "off" says No.
  assert.equal(display(f("pinned"), undefined, feedback), "Not set");
  assert.equal(display(f("pinned"), null, feedback), "Not set");
  assert.equal(display(f("pinned"), false, feedback), "No");
  assert.equal(display(f("status"), "open", feedback), "Open");
  // A record the phone has not reached yet is a date, never "ago", and its own
  // zone needs no label on the clock it prints.
  assert.equal(display(f("createdAt"), row.createdAt, feedback), "Sep 5, 10:20 AM");
  assert.equal(display(f("tags"), ["a", "b"], feedback), "a, b");
  assert.equal(display(f("rank"), 2, feedback), "2");
  assert.equal(display(f("body"), "", feedback), "—");
});

test("detail shows every field in schema order", () => {
  const items = detailItems(note, row, feedback);
  assert.equal(items[0]!.label, "Id");
  assert.equal(items.find((i) => i.label === "Status")!.value, "Open");
  // Each item carries the schema entry it came from: the screen names its row
  // after the field, and never re-derives which column a fact belongs to.
  assert.equal(items.find((i) => i.label === "Status")!.field.name, "status");
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
  // A form edits the whole instant, so the exact spelling keeps the year and — the
  // fake's zone is the fake reader's own — says no zone.
  assert.equal(timeText(at, feedback), "Jan 31, 2026, 09:00 AM");
  assert.equal(
    timeText(at, { ...feedback, ownZone: "America/New_York" }),
    "Jan 31, 2026, 09:00 AM UTC",
  );
  assert.equal(timeValue(""), undefined);
  assert.equal(timeValue("yesterday"), undefined);
  assert.equal(timeValue(undefined), undefined);
});

test("an address is read as the host its owner typed, and nothing else", () => {
  assert.equal(hostLabel("https://acme.example.com"), "acme.example.com");
  assert.equal(hostLabel("https://acme.example.com/"), "acme.example.com");
  assert.equal(hostLabel("http://10.0.2.2:8888"), "10.0.2.2:8888");
  // The scheme's own port is not part of an address, and a host is not spelled in capitals.
  assert.equal(hostLabel("https://ACME.example.com:443/x?a=1#h"), "acme.example.com");
  // A credential in an address is never repeated on a screen.
  assert.equal(hostLabel("http://user:pw@acme.test:8080/p"), "acme.test:8080");
  assert.equal(hostLabel("http://[::1]:8080/x"), "[::1]:8080");
  assert.equal(hostLabel("https://acme.test/privacy"), "acme.test");
  for (const unreadable of ["", "   ", "not a url", "file:///etc/passwd"])
    assert.equal(hostLabel(unreadable), "", unreadable);
});

test("many of an entity is its name with an s, unless the word is already many", () => {
  assert.equal(plural("task"), "tasks");
  assert.equal(plural("settings"), "settings");
  assert.equal(plural("plan"), "plans");
  // A mass noun and a word that already ends in s keep their spelling: "contents",
  // "staffs" and "medias" are not what an entity named "content" or "staff" is called.
  for (const mass of [
    "content",
    "settings",
    "news",
    "media",
    "data",
    "staff",
    "feedback",
    "information",
  ])
    assert.equal(plural(mass), mass, mass);
  assert.equal(plural("contents"), "contents");
});

/** One instant, read under one set of formatting: the rule's own words. */
const read = (at: string, under: Partial<Formatting>) =>
  presentedInstant(timeValue(at)!, { ...feedback, ...under });

const lisbon = { locale: "en-GB", timeZone: "Europe/Lisbon", ownZone: "Europe/Lisbon" };
const york = { locale: "en-US", timeZone: "America/New_York", ownZone: "America/New_York" };
const utc = { locale: "en-US", timeZone: "UTC", ownZone: "UTC" };

// Every row is one line of the rule: what the eye reads, and what a reader says
// aloud. The instants are fixed, so a row decides the same sentence next year.
test("a past instant is a distance while a distance is the answer", () => {
  const cases: readonly [string, string, string, string][] = [
    // 5 minutes ago, and the minute before that, which is only "just now".
    ["2026-07-01T11:59:30Z", "2026-07-01T12:00:00Z", "Just now", "1 Jul 2026, 12:59"],
    ["2026-07-01T12:00:00Z", "2026-07-01T12:05:00Z", "5 minutes ago", "1 Jul 2026, 13:00"],
    // An hour of recency is told as a duration across midnight; the day word takes
    // over only once the clock itself has left today.
    ["2026-06-30T23:30:00Z", "2026-07-01T00:20:00Z", "50 minutes ago", "1 Jul 2026, 00:30"],
    ["2026-06-30T23:00:00Z", "2026-07-01T01:00:00Z", "2 hours ago", "1 Jul 2026, 00:00"],
    ["2026-07-05T12:00:00Z", "2026-07-08T12:00:00Z", "3 days ago", "5 Jul 2026, 13:00"],
    // A distance is counted in the reader's calendar days, so an instant written
    // later in its day than the moment reading it is still the day it is on.
    ["2026-06-29T20:00:00Z", "2026-07-01T12:00:00Z", "2 days ago", "29 Jun 2026, 21:00"],
    ["2026-06-25T22:00:00Z", "2026-07-01T12:00:00Z", "6 days ago", "25 Jun 2026, 23:00"],
    // A week off is a date: nobody counts days that far back. The week is the
    // reader's week of calendar days, so a seventh day is a date even when fewer
    // than 168 hours have passed.
    ["2026-06-24T22:30:00Z", "2026-07-01T12:00:00Z", "24 Jun, 23:30", "24 Jun 2026, 23:30"],
    ["2026-07-01T12:00:00Z", "2026-07-08T12:00:00Z", "1 Jul, 13:00", "1 Jul 2026, 13:00"],
    ["2026-02-01T09:00:00Z", "2026-07-08T12:00:00Z", "1 Feb, 09:00", "1 Feb 2026, 09:00"],
  ];
  for (const [at, now, shown, exact] of cases) {
    const said = read(at, { ...lisbon, now });
    assert.equal(said.shown, shown, `${at} at ${now}`);
    assert.equal(said.exact, exact, `${at} at ${now}`);
  }
  // Yesterday keeps its clock, because which day it was is half the fact.
  const yesterday = read("2026-06-30T14:12:00Z", { ...utc, now: "2026-07-01T15:00:00Z" });
  assert.equal(yesterday.shown, "Yesterday, 02:12 PM");
  assert.equal(yesterday.exact, "Jun 30, 2026, 02:12 PM");
  // A record a year old is said with its year, in either direction.
  assert.equal(
    read("2025-09-05T09:20:00Z", { ...utc, now: "2026-07-18T09:00:00Z" }).shown,
    "Sep 5, 2025, 09:20 AM",
  );
});

test("a future instant is a date, because it has not happened", () => {
  // A server clock a little ahead of the phone is no further off than one a
  // little behind it: a minute either side of now is still now.
  assert.equal(
    read("2026-07-01T09:00:30Z", { ...lisbon, now: "2026-07-01T09:00:00Z" }).shown,
    "Just now",
  );
  // A deadline tomorrow is tomorrow and the hour it is due at.
  const tomorrow = read("2026-07-02T16:00:00Z", { ...lisbon, now: "2026-07-01T09:00:00Z" });
  assert.equal(tomorrow.shown, "Tomorrow, 17:00");
  assert.equal(tomorrow.exact, "2 Jul 2026, 17:00");
  // Later today is only ever the hour; further off is the day, and the year only
  // when it is not the year the reader is in.
  assert.equal(
    read("2026-07-01T22:00:00Z", { ...lisbon, now: "2026-07-01T09:00:00Z" }).shown,
    "23:00",
  );
  assert.equal(
    read("2026-10-14T14:00:00Z", { ...utc, now: "2026-07-01T09:00:00Z" }).shown,
    "Oct 14, 02:00 PM",
  );
  assert.equal(
    read("2027-01-31T15:00:00Z", { ...utc, now: "2026-07-01T09:00:00Z" }).shown,
    "Jan 31, 2027, 03:00 PM",
  );
});

test("a clock is read in the phone's zone and named only when it is not its own", () => {
  // The acceptance: the same two instants on a Lisbon phone and a New York one.
  const summer = "2026-07-01T12:00:00Z",
    winter = "2026-01-15T12:00:00Z",
    now = "2026-10-09T09:00:00Z";
  assert.match(read(summer, { ...lisbon, now }).shown, /^1 Jul, 13:00$/);
  assert.match(read(winter, { ...lisbon, now }).shown, /^15 Jan, 12:00$/);
  assert.match(read(summer, { ...york, now }).shown, /^Jul 1, 08:00 AM$/);
  assert.match(read(winter, { ...york, now }).shown, /^Jan 15, 07:00 AM$/);
  // Hours kept in another zone are a quotation, and say which zone quoted them —
  // every spelling that prints a clock, and none that prints a duration.
  const foreign = { locale: "en-GB", timeZone: "Europe/Lisbon", ownZone: "UTC", now };
  assert.equal(read(summer, foreign).shown, "1 Jul, 13:00 WEST");
  assert.equal(
    read("2026-07-01T12:00:00Z", { ...foreign, now: "2026-07-01T12:05:00Z" }).shown,
    "5 minutes ago",
  );
  assert.equal(
    read("2026-06-30T14:12:00Z", { ...foreign, now: "2026-07-01T15:00:00Z" }).shown,
    "Yesterday, 15:12 WEST",
  );
});

test("a relative instant is said in the copy's own language, and begins as a sentence", () => {
  // The words are ICU's in the copy's language, capitalised as a sentence: a value
  // cell is the whole sentence, so "há" would begin it in lower case.
  const pt = {
    locale: "pt-PT",
    timeZone: "Europe/Lisbon",
    ownZone: "Europe/Lisbon",
    copy: deriveCopy("pt"),
  };
  assert.equal(
    read("2026-07-01T12:00:00Z", { ...pt, now: "2026-07-01T12:05:00Z" }).shown,
    "Há 5 minutos",
  );
  assert.equal(
    read("2026-06-30T14:12:00Z", { ...pt, now: "2026-07-01T15:00:00Z" }).shown,
    "Ontem, 15:12",
  );
  assert.equal(
    read("2026-07-01T14:12:00Z", { ...pt, now: "2026-07-03T15:00:00Z" }).shown,
    "Anteontem",
  );
  assert.equal(
    read("2026-07-01T12:00:00Z", { ...pt, now: "2026-07-01T12:00:20Z" }).shown,
    "Agora mesmo",
  );
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

test("a row previews the record's own words, and does not repeat them as a cell", () => {
  // body is a long text hidden from the table's columns, which is exactly the
  // field worth reading under the row's name.
  assert.equal(listPreview(note)?.name, "body");
  assert.ok(!listCells(note).some((f) => f.name === "body"));
  // An entity with no long text has no line to preview.
  const terse = { ...note, fields: note.fields.filter((f) => f.name !== "body") };
  assert.equal(listPreview(terse), undefined);
});

test("a command's argument is a form built by the rules a field is built by", () => {
  const publish = note.commands.find((c) => c.verb === "publish")!;
  const controls = commandControls(publish);
  assert.equal(controls.length, 1);
  const at = controls[0]!;
  assert.equal(at.kind, "text");
  assert.equal(at.label, "At");
  assert.equal(at.readOnly, false);
  assert.equal(at.help, "When it goes out; now if left empty");
  // A command that takes nothing has no controls, which is what makes it a
  // question rather than a sheet.
  assert.deepEqual(commandControls(note.commands.find((c) => c.verb === "archive")!), []);
});

test("a command is named by its summary, or by its verb when it has none", () => {
  assert.equal(
    commandTitle({ verb: "check-sla", summary: "Check the SLA", fields: [] }),
    "Check the SLA",
  );
  assert.equal(commandTitle({ verb: "set_password", fields: [] }), "Set password");
});

test("the commands about a row and the commands about the list are told apart, by address", () => {
  assert.deepEqual(
    rowCommands(note).map((c) => c.verb),
    ["publish"],
  );
  assert.deepEqual(
    collectionCommands(note).map((c) => c.verb),
    ["archive"],
  );
  assert.equal(commandOf(note, "publish", "record")?.summary, "Publish a note");
  assert.equal(commandOf(note, "archive", "collection")?.summary, "Archive every resolved note");
  // The address says whether there is a row to send, so it decides which form a
  // verb takes: the same verb found on one side of the divider is not on offer
  // at the other, where its POST would name a row the path does not hold.
  assert.equal(commandOf(note, "publish", "collection"), undefined);
  assert.equal(commandOf(note, "archive", "record"), undefined);
  assert.equal(commandOf(note, "nothing", "record"), undefined);
  assert.equal(commandOf(note, "nothing", "collection"), undefined);
  assert.equal(commandScope("42"), "record");
  assert.equal(commandScope(undefined), "collection");
});

test("clearing saved optional text sends an empty value while absent text stays absent", () => {
  const entry = {
    ...note,
    fields: [
      { name: "summary", type: "text" as const },
      { name: "label", type: "string" as const },
      { name: "absent", type: "string" as const },
    ],
  };
  const controls = formControls(entry, { summary: "Old summary", label: "Old label" }, false);
  assert.deepEqual(values(controls, { summary: "", label: "" }), { summary: "", label: "" });
  assert.deepEqual(values(controls, {}), { summary: "Old summary", label: "Old label" });
  assert.deepEqual(values(formControls(entry, undefined, true), {}), {});
  assert.deepEqual(values(formControls(entry, undefined, true), { summary: "" }), {});
});

test("optional defaults are retained unless the person clears their text", () => {
  const entry = { ...note, fields: [{ name: "label", type: "string" as const, default: "New" }] };
  const controls = formControls(entry, undefined, true);
  assert.deepEqual(values(controls, {}), { label: "New" });
  assert.deepEqual(values(controls, { label: "" }), { label: "" });
});

test("list values retain declared integer, float, boolean and string elements", () => {
  const entry = {
    ...note,
    fields: [
      { name: "counts", type: "list" as const, elem: "int" as const },
      { name: "ratios", type: "list" as const, elem: "float" as const },
      { name: "enabled", type: "list" as const, elem: "bool" as const },
      { name: "labels", type: "list" as const, elem: "string" as const },
      { name: "legacy", type: "list" as const },
    ],
  };
  const controls = formControls(entry, undefined, true);
  const held = {
    counts: "-4, 0, 12",
    ratios: "1.25, -0.5, 1e2",
    enabled: "true, false",
    labels: "2, false",
    legacy: "7, 8",
  };
  assert.deepEqual(problems(controls, held), {});
  assert.deepEqual(values(controls, held), {
    counts: [-4, 0, 12],
    ratios: [1.25, -0.5, 100],
    enabled: [true, false],
    labels: ["2", "false"],
    legacy: ["7", "8"],
  });
  assert.deepEqual(values(controls, {}), {
    counts: [],
    ratios: [],
    enabled: [],
    labels: [],
    legacy: [],
  });
});

test("invalid typed list items refuse the whole input without filtering or rounding them", () => {
  for (const [elem, raw] of [
    ["int", "1, 2.5"],
    ["int", "9007199254740993"],
    ["int", "1.0000000000000001"],
    ["int", "9007199254740990.1"],
    ["int", "1e-999"],
    ["int", "1 2"],
    ["float", "2, nope"],
    ["float", "1 2"],
    ["float", "0x10"],
    ["float", "1e999"],
    ["bool", "true, maybe"],
  ] as const) {
    const controls = formControls(
      { ...note, fields: [{ name: "items", type: "list", elem }] },
      undefined,
      true,
    );
    assert.deepEqual(problems(controls, { items: raw }), {
      items: "contains a value that does not match its item type",
    });
    assert.deepEqual(values(controls, { items: raw }), {});
  }
});

// ---------------------------------------------------------------------------
// Where a write goes, and which doors are drawn. One implementation of each,
// which is why these cases are here and not in the screens that use them.
// ---------------------------------------------------------------------------

import { doors, offers, type Entry } from "../src/core/catalog";
import { commandPath, verbRefusal, writePath } from "../src/core/derive";

const control = parseCatalog(
  JSON.parse(
    readFileSync(
      new URL("../testdata/catalog.control-plane.json", import.meta.url).pathname,
      "utf8",
    ),
  ),
);
const priceLists = control.resources[3]!;

test("writePath is the address the entry names, or its own path when it names none", () => {
  assert.equal(writePath(note), "/api/v1/note/notes");
  assert.equal(writePath(priceLists), "/api/v1/ops/pricing/price-lists");
  // A singleton's PUT is a write like any other, and the kernel mounts it on
  // the write surface too (kit/rest/singleton.go), so the same field answers
  // for it; nothing in the phone gets to assume a singleton is read and
  // written at one address.
  assert.equal(writePath(control.resources[4]!), "/api/v1/ops/pricing/currency");
  // The field is never a permission: an entry with no write_path reads its own
  // path whether it is writable or not.
  assert.equal(writePath({ ...note, writable: false }), "/api/v1/note/notes");
});

test("commandPath sends a printed address as printed, and derives one that was never printed", () => {
  // No path printed: today's derivation, byte for byte, verb appended.
  assert.equal(commandPath(note, "publish", "1"), "/api/v1/note/notes/1/publish");
  assert.equal(commandPath(note, "archive"), "/api/v1/note/notes/archive");
  // A path printed is the whole endpoint and already ends in the verb, so the
  // verb is never appended again and only {id} is filled in.
  assert.equal(commandPath(priceLists, "retire", "1"), "/api/v1/ops/pricing/price-lists/1/retire");
  // The row is part of the address; a caller without one cannot ask for it.
  assert.throws(
    () => commandPath(priceLists, "retire"),
    (e: unknown) =>
      e instanceof TypeError &&
      e.message.includes("/api/v1/ops/pricing/price-lists/{id}/retire") &&
      e.message.includes("needs the row"),
  );
  // A printed address with no row in it stands exactly as it is, and a verb
  // this entry does not carry at all is still derived.
  const wholeCollection: Entry = {
    ...priceLists,
    commands: [{ verb: "recalc", path: "/api/v1/ops/pricing/recalculate", fields: [] }],
  };
  assert.equal(commandPath(wholeCollection, "recalc"), "/api/v1/ops/pricing/recalculate");
  // An id is an id wherever it lands, encoded the same way in both spellings.
  assert.equal(commandPath(note, "publish", "a/b"), "/api/v1/note/notes/a%2Fb/publish");
  assert.equal(
    commandPath(priceLists, "retire", "a/b"),
    "/api/v1/ops/pricing/price-lists/a%2Fb/retire",
  );
  // A verb the entry does not carry is derived as it always was: the transport
  // stays the last word on whether an address is sendable at all.
  assert.equal(commandPath(note, "resolve", "1"), "/api/v1/note/notes/1/resolve");
});

test("offers reads an absent set and an empty one as all five", () => {
  const empty: Entry = { ...note, operations: [] };
  for (const verb of ["list", "read", "create", "update", "delete"] as const) {
    assert.equal(offers(note, verb), true, "absent names every verb");
    assert.equal(offers(empty, verb), true, "an empty set means all five");
  }
  const noDelete: Entry = { ...note, operations: ["list", "read", "create", "update"] };
  assert.equal(offers(noDelete, "delete"), false);
  assert.equal(offers(noDelete, "update"), true);
});

test("doors draws a door only where writable and operations both say so", () => {
  // note is the pinned entry: writable, and no operation set at all.
  assert.deepEqual(doors(note), { create: true, update: true, delete: true });
  assert.deepEqual(doors({ ...note, operations: [] }), {
    create: true,
    update: true,
    delete: true,
  });
  assert.deepEqual(doors({ ...note, operations: ["list", "read", "create", "update"] }), {
    create: true,
    update: true,
    delete: false,
  });
  assert.deepEqual(doors({ ...note, operations: ["list", "read", "delete"] }), {
    create: false,
    update: false,
    delete: true,
  });
  // writable is the caller's guard and operations only narrows it: a document
  // that named every verb for a caller who may not write still draws no door.
  assert.deepEqual(
    doors({
      ...note,
      writable: false,
      operations: ["list", "read", "create", "update", "delete"],
    }),
    { create: false, update: false, delete: false },
  );
});

test("a verb that is not offered is refused in the resource's own words", () => {
  // The words name what will not happen, not who refused: a person reading them
  // has no use for the server's vocabulary.
  assert.match(verbRefusal("create"), /^This record cannot be created here\.$/);
  assert.match(verbRefusal("update"), /^This record cannot be edited here\.$/);
  assert.match(verbRefusal("delete"), /^This record cannot be deleted here\.$/);
});
