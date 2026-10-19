// "Recently opened" is this phone's own list: it belongs to one server and one sign-in,
// it replaces a record's row when it is opened again, it is bounded, and it is read newest
// first through the cap Home draws. None of it is a fact about the server — nothing is sent
// anywhere — so every case here is answered by the double that holds the same columns and
// the same scope rule the device's table has.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../src/core/catalog";
import { createRecents } from "../src/effects/recents";
import { RECENT_KEEP, RECENT_SHOWN, recentFrom, recentHref, recentKey } from "../src/core/recents";
import { address } from "../src/core/reentry";
import { clock, fakeRecentsStore } from "./fakes/store";
const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));

const ADA = { server: "https://acme.test", userId: "ada" };
const BEA = { server: "https://acme.test", userId: "bea" };

const note = catalog.resources.find((r) => r.entity === "note")!;

const opened = (at: string, id: string, title = `Note ${id}`) => ({
  resourceKey: "note/note",
  recordId: id,
  title,
  openedAt: at,
});

const recentsFor = (
  store: ReturnType<typeof fakeRecentsStore>,
  at = "2026-10-06T10:00:00.000Z",
) => {
  const watch = clock(at);
  return {
    ...createRecents({
      store: store.store,
      clock: watch,
      scope: () => ADA,
    }),
    watch,
  };
};

test("an open is stamped by the clock this unit was given, in UTC", async () => {
  const store = fakeRecentsStore();
  const recents = recentsFor(store, "2026-10-06T10:00:00.000Z");
  await recents.opened({ resourceKey: "note/note", recordId: "n-1", title: "Standup" });
  assert.deepEqual(
    store.rows.map((row) => row.item),
    [opened("2026-10-06T10:00:00.000Z", "n-1", "Standup")],
  );
  // The same open, later: the stamp moves with the clock, so the section's order is the
  // moment the person tapped, not the moment the row was first written.
  recents.watch.set("2026-10-06T18:00:00.000Z");
  await recents.opened({ resourceKey: "note/note", recordId: "n-2", title: "Retro" });
  assert.deepEqual(
    (await recents.list()).map((row) => [row.recordId, row.openedAt]),
    [
      ["n-2", "2026-10-06T18:00:00.000Z"],
      ["n-1", "2026-10-06T10:00:00.000Z"],
    ],
  );
});

test("an open with no owner stores nothing and reads nothing", async () => {
  const store = fakeRecentsStore();
  const watch = clock("2026-10-06T10:00:00.000Z");
  const orphan = createRecents({ store: store.store, clock: watch, scope: () => undefined });
  await orphan.opened({ resourceKey: "note/note", recordId: "n-1", title: "Standup" });
  assert.equal(store.rows.length, 0, "a row with no server and no person would be nobody's");
  assert.deepEqual(await orphan.list(), []);
  assert.deepEqual(store.calls, [], "an unscoped open never reaches the table");
});

test("one sign-in reads their own opens, never another's, at the same phone", async () => {
  const store = fakeRecentsStore();
  const ada = recentsFor(store);
  await ada.opened({ resourceKey: "note/note", recordId: "n-1", title: "Ada's" });
  const watch = clock("2026-10-06T11:00:00.000Z");
  const bea = createRecents({
    store: store.store,
    clock: watch,
    scope: () => ({ server: ADA.server, userId: BEA.userId }),
  });
  assert.deepEqual(await bea.list(), [], "the section is empty because nobody deleted anything");
  await bea.opened({ resourceKey: "note/note", recordId: "n-2", title: "Bea's" });
  assert.deepEqual(
    (await bea.list()).map((row) => row.title),
    ["Bea's"],
  );
  assert.deepEqual(
    (await ada.list()).map((row) => row.title),
    ["Ada's"],
  );
});

test("an open replaces the same record's row, so reopening is not two rows", async () => {
  const store = fakeRecentsStore();
  const ada = recentsFor(store);
  await ada.opened({ resourceKey: "note/note", recordId: "n-1", title: "Draft" });
  ada.watch.set("2026-10-06T12:00:00.000Z");
  await ada.opened({ resourceKey: "note/note", recordId: "n-1", title: "Draft, renamed" });
  assert.equal(store.rows.length, 1);
  assert.deepEqual(await ada.list(), [opened("2026-10-06T12:00:00.000Z", "n-1", "Draft, renamed")]);
});

test("the device keeps twenty, Home is shown five, and the oldest opens go first", async () => {
  const store = fakeRecentsStore();
  const ada = recentsFor(store, "2026-10-06T10:00:00.000Z");
  const at = (i: number) => `2026-10-06T10:00:${String(i).padStart(2, "0")}.000Z`;
  for (let i = 0; i < RECENT_KEEP + 5; i++) {
    ada.watch.set(at(i));
    await ada.opened({ resourceKey: "note/note", recordId: `n-${i}`, title: `Note ${i}` });
  }
  assert.equal(store.rows.length, RECENT_KEEP, "the bound is kept while the list is written");
  const shown = await ada.list();
  assert.equal(shown.length, RECENT_SHOWN);
  // The five most recent opens, in the order they happened for the reader.
  assert.deepEqual(
    shown.map((row) => row.recordId),
    ["n-24", "n-23", "n-22", "n-21", "n-20"],
  );
});

test("an open of a record this row no longer names is refused as a row", () => {
  // A row that names no record, or says nothing about when, is not a remembered open: the
  // device would draw a row that opens nowhere, or order one it cannot place in time.
  assert.throws(() => recentFrom({ resourceKey: "", recordId: "n-1", title: "x", openedAt: "t" }));
  assert.throws(() =>
    recentFrom({ resourceKey: "note/note", recordId: "n-1", title: "x", openedAt: "" }),
  );
  assert.equal(recentKey(opened("t", "n-1")), "note/note/n-1");
});

test("a remembered open leads to the record itself, at the address the router knows", () => {
  const door = { recent: opened("2026-10-06T10:00:00.000Z", "n-7"), entry: note };
  assert.equal(recentHref(door), address("detail", note, "n-7"));
  assert.equal(recentHref(door), "/note/note/n-7");
  // An id is one path segment whatever it is spelled with: the remembered open escapes it
  // the way the list's own row-open does, so a record id with a space opens one record.
  assert.equal(
    recentHref({ recent: opened("2026-10-06T10:00:00.000Z", "n 7"), entry: note }),
    "/note/note/n%207",
  );
});

test("a withdrawn open leaves this person's other opens, and every other person's", async () => {
  const store = fakeRecentsStore();
  const ada = recentsFor(store);
  await ada.opened({ resourceKey: "note/note", recordId: "n-1", title: "Ada's" });
  await ada.opened({ resourceKey: "note/note", recordId: "n-2", title: "Retro" });
  const bea = createRecents({
    store: store.store,
    clock: clock("2026-10-06T11:00:00.000Z"),
    scope: () => BEA,
  });
  await bea.opened({ resourceKey: "note/note", recordId: "n-1", title: "Bea's" });
  await ada.forgot({ resourceKey: "note/note", recordId: "n-1" });
  assert.deepEqual(
    (await ada.list()).map((row) => row.recordId),
    ["n-2"],
    "the record this phone deleted is the only row that went",
  );
  // Same resource and same record id under another sign-in: a door of theirs, untouched.
  assert.deepEqual(
    (await bea.list()).map((row) => row.recordId),
    ["n-1"],
  );
  // Withdrawing an open the list never held changes no row.
  await ada.forgot({ resourceKey: "note/note", recordId: "never-opened" });
  assert.equal(store.rows.length, 2, "one row per person's open, and nothing lost");
});

test("a withdrawal with no owner stores nothing and asks the table for nothing", async () => {
  const store = fakeRecentsStore();
  const orphan = createRecents({
    store: store.store,
    clock: clock("2026-10-06T10:00:00.000Z"),
    scope: () => undefined,
  });
  await store.store.save(ADA, opened("2026-10-06T10:00:00.000Z", "n-1", "Standup"));
  await orphan.forgot({ resourceKey: "note/note", recordId: "n-1" });
  // A statement that names no server and no sign-in deletes nobody's row: the row stays,
  // and the table was never asked.
  assert.equal(store.rows.length, 1);
  assert.deepEqual(store.calls, ["save"]);
});
