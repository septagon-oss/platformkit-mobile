// A step asks the fields it names and nothing else: the controls it draws are found by name
// among `formControls`' answer, in the order the step asks them, and what no step asks stays
// in the body the write sends without ever reaching the screen.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import {
  type FormBlock,
  formControls,
  stepBlocks,
  steppedForm,
  writeControls,
} from "../src/core/form";
import { steppedNote } from "./fakes/steps";

const read = (doc: unknown) => parseCatalog(doc, () => {}).resources[0]!;
const names = (blocks: readonly FormBlock[]) =>
  blocks.map((b) => [b.key, b.label, b.controls.map((c) => c.field.name)]);

test("each step of the kernel's create form asks its own fields, in its own order", () => {
  const entry = read(steppedNote());
  const steps = steppedForm(entry, true)!;
  const blocks = stepBlocks(steps, formControls(entry, undefined, true));
  assert.deepEqual(names(blocks), [
    ["unsectioned", "Details", ["title"]],
    ["section:details", "Description", ["body", "rank"]],
    ["section:options", "Options", ["pinned", "tags"]],
  ]);
  // The whole walk asks each editable field exactly once, in the order the form edits them.
  assert.deepEqual(
    blocks.flatMap((b) => b.controls.map((c) => c.field.name)),
    [...(entry.resolved!.layout.create ?? [])],
  );
});

test("a field no step asks is written but never walked", () => {
  // The note's `status` is the field the resolved form leaves out of its editable set: the
  // stepped sheet never draws it, and a PUT that omitted it would clear it.
  const entry = read(JSON.parse(readFileSync("testdata/catalog.deck.json", "utf8").toString()));
  const row = { id: "1", title: "Note", body: "", status: "open", rank: 3, pinned: true, tags: "" };
  const steps = steppedForm(entry, false)!;
  const drawn = formControls(entry, row, false);
  const blocks = stepBlocks(steps, drawn);
  assert.deepEqual(
    blocks.flatMap((b) => b.controls.map((c) => c.field.name)),
    ["title", "body", "rank", "pinned", "tags"],
  );
  const body = writeControls(
    entry,
    row,
    blocks.flatMap((b) => b.controls),
  );
  assert.ok(
    body.some((c) => c.field.name === "status" && c.echo === "open"),
    "the field off the walk travels back as the row gave it",
  );
});

test("a step the sheet would draw empty is no step at all", () => {
  const entry = read(steppedNote());
  const steps = steppedForm(entry, true)!;
  const drawn = formControls(entry, undefined, true);
  const withoutOptions = drawn.filter((c) => c.field.name !== "pinned" && c.field.name !== "tags");
  assert.deepEqual(
    stepBlocks(steps, withoutOptions).map((b) => b.key),
    ["unsectioned", "section:details"],
    "an empty card is dropped rather than drawn",
  );
  // Nothing left to walk is not a walk: the person gets the one scroll the entry asks for.
  assert.deepEqual(stepBlocks(steps, []), []);
});
