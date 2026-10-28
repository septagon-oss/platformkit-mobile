// The stepped form a person walks is the server's, never this repository's: the reading
// reaches the kernel's own stepped bytes, reaches the three-step create case the kernel
// resolves in Go, and says "flat" for every entry that does not state the member — which
// is what makes the opt-in the only opt-in.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { formControls, stepBlocks, steppedForm } from "../src/core/form";
import { steppedNote } from "./fakes/steps";

const read = (doc: unknown) => {
  const notices: string[] = [];
  const entry = parseCatalog(doc, (at, why) => notices.push(`${at} ${why}`)).resources[0]!;
  return { entry, notices };
};
const blocks = (
  walk: readonly { key: string; label: string; controls: readonly { field: { name: string } }[] }[],
) => walk.map((b) => [b.key, b.label, b.controls.map((c) => c.field.name)]);
const golden = (name: string) =>
  JSON.parse(readFileSync(`testdata/${name}`, "utf8").toString()) as unknown;

test("the kernel's stepped bytes reach the one step its own document states", () => {
  const { entry, notices } = read(golden("catalog.deck.json"));
  assert.deepEqual(notices, [], "the stepped capture is a policy this build reads");
  const steps = steppedForm(entry, false);
  assert.equal(steps?.length, 1, "the note's edit sheet is one step");
  const [only] = steps!;
  assert.equal(only!.key, "unsectioned");
  assert.equal(only!.label, "Details");
  assert.deepEqual(only!.fields, ["title", "body", "rank", "pinned", "tags"]);
  assert.equal(only!.primaryLabel, "Save the note");
  // The same entry's create sheet names no stepped form: per-form opt-in means the
  // person who starts a note is asked for it in one scroll.
  assert.equal(steppedForm(entry, true), undefined);
  // One step is still the walk the sheet draws: its block holds every field that step asks,
  // and nothing else is on the screen.
  assert.deepEqual(blocks(stepBlocks(steps ?? [], formControls(entry, undefined, false))), [
    // In the step's own order, not the entry's: the block asks what the step asks, when the
    // step asks it.
    ["unsectioned", "Details", ["title", "body", "rank", "pinned", "tags"]],
  ]);
});

test("a stepped create form of three steps is read as three steps in its own order", () => {
  const { entry, notices } = read(steppedNote());
  assert.deepEqual(notices, []);
  const steps = steppedForm(entry, true);
  assert.deepEqual(
    steps?.map((s) => [s.key, s.label, s.fields, s.primaryLabel]),
    [
      ["unsectioned", "Details", ["title"], "Next · {answer}"],
      ["section:details", "Description", ["body", "rank"], "Next"],
      ["section:options", "Options", ["pinned", "tags"], "Save note"],
    ],
    "the walk, its words and its groups are the server's",
  );
  assert.equal(steppedForm(entry, false), undefined, "the edit sheet of this block stays flat");
});

test("a form without the stepped declaration walks as it does today", () => {
  for (const name of ["catalog.json", "catalog.hints.json", "catalog.pictures.json"]) {
    const { entry, notices } = read(golden(name));
    assert.deepEqual(
      notices.filter((n) => n.includes(".resolved")),
      [],
    );
    assert.equal(steppedForm(entry, true), undefined, `${name} states no stepped create form`);
    assert.equal(steppedForm(entry, false), undefined, `${name} states no stepped update form`);
  }
  // A block that names the member and leaves every form out is the same answer: an
  // older server and a server that opted nothing in are not worth a notice or a step.
  const { entry, notices } = read(steppedNote((note) => (note.resolved.layout.forms = {})));
  assert.deepEqual(notices, []);
  assert.equal(steppedForm(entry, true), undefined);
  assert.equal(steppedForm(entry, false), undefined);
});
