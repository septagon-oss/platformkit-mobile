// Where a drag has got, and which command a row would run: the one arithmetic a swiped surface
// makes, and the one resolution of the entry's declared verb. Both are read the same way by the
// reanimated surface on a device and by the fake a component suite drives, so a threshold that moves
// in src/ui/scale.ts moves the answer, and nothing in a surface gets to decide it twice.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import { readSwipe } from "../src/core/gesture";
import { rowAction, rowSwipeTone } from "../src/core/derive";
import { feedback } from "./fakes/presentation";

const golden = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8"));

/**
 * One surface's width, in the density-independent lengths src/ui/scale.ts writes. The reading is
 * asked of it rather than of the page's real measure, which a Node process has no: the suite that
 * draws a row asks the same function with `swipe.reveal` and so proves the two are one number.
 */
const reveal = 72;

/** The golden's first entry, given a record verb of its own to run from a row. */
function entryWith(
  mutate: (entry: Record<string, unknown>) => void = (entry) => {
    (entry.commands as Record<string, unknown>[]).push({
      verb: "resolve",
      summary: "Resolve the note",
    });
    entry.presentation = { primaryCommand: "resolve" };
  },
): Entry {
  const doc = golden();
  mutate(doc.resources[0]);
  return parseCatalog(doc).resources[0]!;
}

test("a drag short of the surface's width is not yet the command", () => {
  const read = readSwipe(reveal - 1, reveal);
  assert.equal(read.armed, false);
  assert.equal(read.open, reveal - 1);
});

test("a drag to the width the surface stands open at is the command", () => {
  const read = readSwipe(reveal, reveal);
  assert.equal(read.armed, true);
  assert.equal(read.open, reveal);
});

test("a drag past the width opens no more of the surface than stands open", () => {
  const read = readSwipe(reveal * 4, reveal);
  assert.equal(read.armed, true);
  assert.equal(read.open, reveal);
});

test("a drag back across the row reads as closed, and a drag never measured is closed", () => {
  assert.deepEqual(readSwipe(-40, reveal), { open: 0, armed: false });
  assert.deepEqual(readSwipe(Number.NaN, reveal), { open: 0, armed: false });
  assert.deepEqual(readSwipe(Number.POSITIVE_INFINITY, reveal), { open: 0, armed: false });
});

test("a surface measured as nothing arms on nothing", () => {
  for (const width of [0, -1, Number.NaN])
    assert.deepEqual(readSwipe(reveal, width), { open: 0, armed: false });
});

test("the row's command is the entry's own verb, in the words the command already uses", () => {
  const action = rowAction(entryWith(), feedback.copy);
  assert.deepEqual(action, {
    verb: "resolve",
    label: "Resolve",
    success: "Resolve done",
    consequence: "",
    destructive: false,
  });
  assert.equal(rowSwipeTone(action!), "primary");
});

test("the sentence the bar reads is the one the dialog would have read", () => {
  const action = rowAction(
    entryWith((entry) => {
      const commands = entry.commands as Record<string, unknown>[];
      commands.push({
        verb: "resolve",
        summary: "Resolve the note",
        presentation: { successMessage: "The note is resolved" },
      });
      entry.presentation = { primaryCommand: "resolve" };
    }),
    feedback.copy,
  );
  assert.equal(action?.success, "The note is resolved");
});

test("a command that hurts is revealed in the pair that hurts", () => {
  const action = rowAction(
    entryWith((entry) => {
      const commands = entry.commands as Record<string, unknown>[];
      commands.push({
        verb: "resolve",
        summary: "Resolve the note",
        presentation: { destructive: true },
      });
      entry.presentation = { primaryCommand: "resolve" };
    }),
    feedback.copy,
  );
  assert.equal(action?.destructive, true);
  assert.equal(rowSwipeTone(action!), "destructive");
});

test("the word under a finger wears the picture the entry itself declared", () => {
  const drawn = rowAction(
    entryWith((entry) => {
      (entry.commands as Record<string, unknown>[]).push({ verb: "resolve" });
      entry.presentation = { icon: "task", primaryCommand: "resolve" };
    }),
    feedback.copy,
  );
  assert.equal(drawn?.icon, "task");
  // An entry that names no picture is the word alone: nothing is guessed at to fill the space.
  assert.equal("icon" in (rowAction(entryWith(), feedback.copy) ?? {}), false);
});

test("an entry that names no row command has none, however it is otherwise described", () => {
  assert.equal(
    rowAction(
      entryWith(() => undefined),
      feedback.copy,
    ),
    undefined,
  );
  // A verb the parser refused is a verb the row does not run: the two readings are one reading.
  assert.equal(
    rowAction(
      entryWith((entry) => {
        entry.presentation = { primaryCommand: "publish" };
      }),
      feedback.copy,
    ),
    undefined,
  );
});
