// How a list is being read is two questions, and the kit asks them separately: in what
// order, and narrowed how. A sheet of orders words each one for the type of the field it
// sorts — a deadline is "soonest first", a rank is "low to high", a title is "A–Z" — and
// offers nothing that has no honest direction or is plumbing. A filters sheet always
// answers its own "All", never "Clear" standing where "All" is meant, and the one action
// that empties the groups appears only when something is filtered; clearing keeps the
// sort, because ordering is not narrowing. Under the header, the filters control counts
// what it can clear, the bar that holds both doors is named for itself, and neither
// control is offered on a list that holds nothing and has nothing filtered.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import { deriveCatalogList } from "../src/core/catalogList";
import {
  activeFilters,
  deriveCopy,
  deriveFilterSheet,
  deriveListToolbar,
  deriveSortSheet,
  filtered,
  noOrder,
  sortFields,
  sortOptions,
  type Order,
} from "../src/core/derive";
import { presentation } from "./fakes/presentation";

const golden = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url), "utf8"));

/** The served golden's note entry with the entry-level hints this case is about. */
function plainEntry(hints: Record<string, unknown> = {}): Entry {
  const doc = golden();
  doc.resources[0].presentation = hints;
  return parseCatalog(doc).resources[0]!;
}

/** The served golden, fresh, with one more field on the entry. */
function fieldAdded(field: Record<string, unknown>): Entry {
  const doc = golden();
  doc.resources[0].fields.push(field);
  return parseCatalog(doc).resources[0]!;
}

/** The same, with one field declared the way a case needs it declared. */
function fieldDeclared(
  name: string,
  hints: Record<string, unknown>,
  entryHints: Record<string, unknown> = {},
): Entry {
  const doc = golden();
  doc.resources[0].presentation = entryHints;
  const field = (doc.resources[0].fields as Record<string, unknown>[]).find(
    (f) => f.name === name,
  )!;
  field.presentation = { ...(field.presentation as object), ...hints };
  return parseCatalog(doc).resources[0]!;
}

const labels = (entry: Entry, p = presentation) => sortOptions(entry, p).map((o) => o.label);
const values = (entry: Entry, p = presentation) => sortOptions(entry, p).map((o) => o.value);

const model = (entry: Entry, order: Order, rows: number, canCreate = true, more = false) => {
  const derived = deriveCatalogList(
    {
      entry,
      rows: rows === 0 ? [] : [{ id: "1", title: "Buy milk", status: "open" }],
      total: rows + (more ? 1 : 0),
      loading: false,
      refreshing: false,
      more,
      error: "",
      order,
      canCreate,
    },
    presentation,
  );
  assert.equal(derived.ok, true, JSON.stringify(derived));
  if (!derived.ok) throw new Error("unreachable");
  return derived.value;
};

const toolbar = (entry: Entry, order: Order, rows: number) => {
  const derived = deriveListToolbar({ entry, order, rows }, presentation);
  assert.equal(derived.ok, true, JSON.stringify(derived));
  if (!derived.ok) throw new Error("unreachable");
  return derived.value;
};

const sortSheet = (entry: Entry, open = true) => {
  const derived = deriveSortSheet({ open, entry }, presentation);
  assert.equal(derived.ok, true, JSON.stringify(derived));
  if (!derived.ok) throw new Error("unreachable");
  return derived.value;
};

const filterSheet = (entry: Entry, order: Order, open = true) => {
  const derived = deriveFilterSheet({ open, entry, order }, presentation);
  assert.equal(derived.ok, true, JSON.stringify(derived));
  if (!derived.ok) throw new Error("unreachable");
  return derived.value;
};

test("the sheet's rows are the orders the kernel accepts, worded for the field's own type", () => {
  // Nothing declared: the field the list leads with, then the date fields the entry
  // declares. A `time` field, a closed set, a number and a stamp each answer their
  // own pair of words, and the two stamps are said by the first two rows already.
  const withDue = fieldAdded({ name: "dueAt", type: "time" });
  assert.deepEqual(values(withDue).slice(0, 2), ["", "createdAt"]);
  assert.deepEqual(
    sortFields(withDue).map((f) => f.name),
    ["title", "dueAt"],
  );
  assert.deepEqual(labels(withDue).slice(2), [
    "Title, A–Z",
    "Title, Z–A",
    "Due at, soonest first",
    "Due at, latest first",
  ]);
  const typed = (hints: Record<string, unknown>) => labels(plainEntry(hints));
  assert.deepEqual(typed({ sortable: ["title"] }).slice(2), ["Title, A–Z", "Title, Z–A"]);
  assert.deepEqual(typed({ sortable: ["rank"] }).slice(2), [
    "Rank, low to high",
    "Rank, high to low",
  ]);
  // Portuguese, from the table and not from a branch: no English word survives.
  const pt = { ...presentation, copy: deriveCopy("pt") };
  assert.deepEqual(labels(plainEntry({ sortable: ["rank"] }), pt).slice(2), [
    "Rank, crescente",
    "Rank, decrescente",
  ]);
  assert.deepEqual(labels(plainEntry(), pt).slice(0, 2), [
    "Mais recentes primeiro",
    "Mais antigos primeiro",
  ]);
});

test("a sort row is offered for no field that has no direction, or that no screen shows", () => {
  const said = labels(plainEntry({ sortable: ["pinned", "tags", "id", "createdAt"] }));
  assert.deepEqual(said, ["Newest first", "Oldest first"]);
  // Declared is not the same as offerable: a field the document calls plumbing is
  // never named in a sheet, because naming it there names it on screen.
  assert.deepEqual(
    labels(fieldDeclared("rank", { visibility: "hidden" }, { sortable: ["rank"] })),
    ["Newest first", "Oldest first"],
  );
  assert.deepEqual(
    sortFields(plainEntry({ sortable: ["rank"] })).map((f) => f.name),
    ["rank"],
  );
});

test("a sort name that matches no field costs one row and one line to a developer", () => {
  const lines: string[] = [];
  const doc = golden();
  doc.resources[0].presentation = { sortable: ["whoKnows"] };
  const entry = parseCatalog(doc, (at, why) => lines.push(`${at} ${why}`)).resources[0]!;
  assert.deepEqual(
    lines,
    [
      "resources[0].presentation.sortable[0] names no field of this entry: it is not offered as a sort",
    ],
    "the line quotes the document's own place, not the list left after rubbish was dropped",
  );
  // The default reads on, rather than an entry with no orders at all.
  assert.deepEqual(
    sortFields(entry).map((f) => f.name),
    ["title"],
  );
});

test("the sort sheet is the list's own sort group, and pressing a row is the whole answer", () => {
  const entry = plainEntry({ sortable: ["title"] });
  const list = model(entry, noOrder, 1);
  const sheet = sortSheet(entry);
  assert.equal(sheet.groupId, "sort");
  assert.equal(sheet.surface.title, "Sort");
  assert.equal(sheet.surface.close.id, "close");
  assert.equal(sheet.surface.bar.actions.length, 0, "choosing a row is not a draft");
  assert.equal(sheet.surface.gestureDismissal, true);
  assert.deepEqual(values(entry), ["", "createdAt", "title", "-title"]);
  assert.deepEqual(
    list.sort?.targets.map((t) => t.order.sort),
    values(entry),
    "the sheet offers the bytes the kernel is sent, unchanged by the new words over them",
  );
});

test("every filter group answers All, and the word Clear says nothing else", () => {
  const entry = plainEntry();
  const list = model(entry, noOrder, 1);
  const group = list.filters[0]!;
  assert.equal(group.model.choices[0]!.label, "All");
  assert.equal(group.model.choices[0]!.selected, true);
  assert.equal(group.model.canClear, false, "a group that always answers needs no reset");
  const sheet = filterSheet(entry, noOrder);
  assert.equal(sheet.surface.title, "Filters");
  assert.deepEqual(
    sheet.groupIds,
    list.filters.map((f) => f.model.id),
  );
  assert.equal(sheet.clearTarget, undefined, "nothing is filtered, so nothing is offered");
  assert.equal(JSON.stringify(sheet.surface).includes("Clear"), false);
});

test("Clear filters is offered only where it has something to do, and keeps the sort", () => {
  const entry = plainEntry();
  const order: Order = { sort: "title", filters: { status: "done" } };
  const sheet = filterSheet(entry, order);
  assert.deepEqual(sheet.clearTarget, { sort: "title", filters: {} });
  assert.equal(sheet.surface.bar.actions.map((a) => a.id).join(), "clear-filters");
  // Choosing All from the group sends no filter parameter at all, never `status:`.
  const list = model(entry, order, 1);
  const all = list.filters[0]!.targets.find((t) => t.id === "all")!;
  assert.deepEqual(all.order.filters, {});
});

test("the filters control counts what it can clear, and an order is never counted", () => {
  const entry = plainEntry();
  assert.equal(
    toolbar(entry, noOrder, 3)
      .bar.actions.map((a) => a.label)
      .join(" | "),
    "Sort | Filters",
  );
  const two: Order = { sort: "", filters: { status: "done", kind: "a" } };
  // `kind` is no field of this entry, so the control cannot clear it and does not
  // claim to: one of the two is counted, while `filtered` still answers true.
  assert.equal(toolbar(entry, two, 3).bar.actions[1]!.label, "Filters · 1");
  assert.equal(filtered(two), true);
  // A value the sheet cannot reach at all is filtered and counted as nothing.
  assert.equal(
    toolbar(entry, { sort: "", filters: { kind: "a" } }, 3).bar.actions[1]!.label,
    "Filters",
  );
  assert.equal(filtered({ sort: "", filters: { kind: "a" } }), true);
  assert.equal(toolbar(entry, { sort: "title", filters: {} }, 3).bar.actions[1]!.label, "Filters");
  const only: Order = { sort: "", filters: { status: "done" } };
  assert.equal(toolbar(entry, only, 3).bar.actions[1]!.label, "Filters · 1");
  assert.equal(activeFilters(only, entry), 1);
});

test("the bar that holds both doors is named for the bar and not for one door", () => {
  // `ActionBar` reads the accessible name of its group from this label. A bar named
  // "Sort" would tell a reader that the group *is* its Sort button, and leave the
  // Filters door beside it standing under the wrong name — in both bundles.
  assert.equal(toolbar(plainEntry(), noOrder, 3).bar.label, "List controls");
  const pt = { ...presentation, copy: deriveCopy("pt") };
  const said = deriveListToolbar({ entry: plainEntry(), order: noOrder, rows: 3 }, pt);
  assert.equal(said.ok, true, JSON.stringify(said));
  if (!said.ok) throw new Error("unreachable");
  assert.equal(said.value.bar.label, "Controles da lista");
});

test("an entry with nothing to narrow by is offered no filters control at all", () => {
  const bare: Entry = {
    ...plainEntry(),
    fields: plainEntry().fields.filter((f) => !f.enum || f.enum.length === 0),
  };
  assert.deepEqual(
    toolbar(bare, noOrder, 3).bar.actions.map((a) => a.id),
    ["sort"],
  );
  assert.deepEqual(
    toolbar(plainEntry(), noOrder, 3).bar.actions.map((a) => a.id),
    ["sort", "filters"],
  );
});

test("a list with nothing on it and nothing filtered offers neither control", () => {
  assert.deepEqual(toolbar(plainEntry(), noOrder, 0).bar.actions, []);
  // Once something is filtered, the way out stays on the screen it describes.
  assert.deepEqual(
    toolbar(plainEntry(), { sort: "", filters: { status: "done" } }, 0).bar.actions.map(
      (a) => a.id,
    ),
    ["sort", "filters"],
  );
});

test("sorting an empty list says it is empty, not that something filtered it", () => {
  const empty = model(plainEntry(), { sort: "title", filters: {} }, 0);
  assert.equal(empty.state?.title, "No notes yet");
  assert.equal(empty.state?.body, "Create a note to get started.");
  assert.equal(JSON.stringify(empty.state).includes("No matching"), false);
  const readOnly = model(plainEntry(), noOrder, 0, false);
  assert.equal(readOnly.state?.title, "No notes yet");
  assert.equal(readOnly.state?.body, "Notes will appear here when they're available.");
  assert.equal(readOnly.state?.actions.length, 0);
});

test("a filtered-empty list is said in the table's words and holds its own way back", () => {
  const narrowed = model(plainEntry(), { sort: "title", filters: { status: "done" } }, 0);
  assert.equal(narrowed.state?.title, "No matching notes");
  assert.equal(narrowed.state?.body, "Try another search or clear your filters.");
  assert.deepEqual(
    narrowed.state?.actions.map((a) => a.id),
    ["new", "clear-filters"],
  );
  // The Portuguese answers come from the same table, with no language branch to
  // fall through: the derivation never asks which bundle it was handed.
  const pt = model(
    plainEntry({ sortable: ["title"] }),
    { sort: "", filters: { status: "done" } },
    1,
  );
  assert.equal(pt.sections.length, 1);
});

test("the list keeps the sort and filter it was asked with while it loads more", () => {
  // A page two is the same order as page one: the sheet changed the order, the
  // order is what the window is read with, and paging is not a fresh question.
  const entry = plainEntry({ sortable: ["title"] });
  const list = model(entry, { sort: "title", filters: { status: "done" } }, 1, true, true);
  assert.equal(list.more?.label, "Load more", "the rest of the page is still on its way");
  assert.deepEqual(
    list.filters[0]!.targets.map((t) => t.order.sort),
    ["title", "title", "title"],
    "a filter chosen after a sort leaves the sort where it was",
  );
});
