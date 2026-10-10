// A collection row's cell carries both spellings of an instant — the distance the eye
// reads and the whole local date-time a screen reader says — because a row is one
// focusable element whose label is its cells: a row that read "Held at: 5 minutes ago"
// and said nothing else would claim a record is newer than its own label disproves.
// A value that is already the whole fact carries no second spelling.
import assert from "node:assert/strict";
import test from "node:test";
import type { Entry } from "../src/core/catalog";
import { deriveCatalogList } from "../src/core/catalogList";
import { noOrder } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

// An entity with few fields, so the time is still among the few cells a row shows:
// a closed set, a yes-or-no and a number each rank ahead of a time.
const meeting: Entry = {
  module: "meeting",
  entity: "meeting",
  path: "/api/v1/meeting/meetings",
  writable: true,
  singleton: false,
  immutable: [],
  commands: [],
  fields: [
    { name: "id", type: "uuid", readOnly: true },
    { name: "topic", type: "string" },
    { name: "heldAt", type: "time" },
    { name: "minutes", type: "int" },
  ],
};

const listed = () => {
  const derived = deriveCatalogList(
    {
      entry: meeting,
      rows: [{ id: "m1", topic: "Kickoff", heldAt: "2026-07-18T08:55:00Z", minutes: 30 }],
      total: 1,
      loading: false,
      refreshing: false,
      more: false,
      error: "",
      order: noOrder,
      canCreate: true,
    },
    presentation,
  );
  assert.equal(derived.ok, true, JSON.stringify(derived));
  // The held time ranks behind the number: a time is what few people scan for.
  return derived.ok ? derived.value.sections[0]!.rows[0]!.cells : [];
};

test("a row's time cell carries the instant it stands for beside the distance it shows", () => {
  const cell = listed().find((c) => c.id === "heldAt")!;
  assert.equal(cell.label, "Held at");
  assert.equal(cell.value, "5 minutes ago");
  assert.equal(cell.spoken, "Jul 18, 2026, 08:55 AM");
});

test("a cell whose shown words are the whole fact carries no second spelling", () => {
  const cell = listed().find((c) => c.id === "minutes")!;
  assert.equal(cell.value, "30");
  assert.equal("spoken" in cell, false);
});
