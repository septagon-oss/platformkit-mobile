// Which states count as *finished* is the author's fact, served in the document, and this phone only
// reads it. These are the bytes that rule and what an author's mistake costs: the hint is read off the
// entry's `statusField` alone, a value the field's enum does not hold is refused by name, one bad entry
// costs the celebration and never the field beside it, and nothing is ever inferred from a colour, from a
// word the pill happens to wear, or from a value a document happened to use. Every case is served bytes
// through the shipped `parseCatalog` — the kernel refuses a malformed hint at mount (`kit/rest/hints.go`),
// so these bytes decide the phone's robustness, not a server's behaviour — and the pinned captures are
// read rather than recalled: the golden's `note.status` is `open`/`done`, and the pictures capture's
// `task.status` is finished at `resolved` and not at `closed`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import {
  finishedValues,
  formControls,
  isFinished,
  listCells,
  rowCommands,
  statusPill,
  statusTone,
  values,
  writePath,
} from "../src/core/derive";
import { presentation } from "./fakes/presentation";
import { unresolved } from "./fakes/unresolved";

const golden = () =>
  unresolved(
    JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url), "utf8")),
  );
const pictures = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.pictures.json", import.meta.url), "utf8"));

/** The golden's note, as its author described it, plus the notice the parse attached. */
function note(mutate: (entry: Record<string, unknown>) => void): {
  readonly entry: Entry;
  readonly lines: readonly string[];
} {
  const doc = golden();
  mutate(doc.resources[0]);
  const lines: string[] = [];
  const catalog = parseCatalog(doc, (at, why) => lines.push(`${at} ${why}`));
  return { entry: catalog.resources[0]!, lines };
}

/** The golden's note with its state declared, and these as the values that finish it. */
const declaring = (doneValues: unknown) =>
  note((e) => {
    e.presentation = { statusField: "status" };
    const field = (e.fields as Record<string, unknown>[]).find((f) => f.name === "status")!;
    field.presentation = { ...(field.presentation ?? {}), doneValues };
  });

const statusHints = (entry: Entry) => entry.fields.find((f) => f.name === "status")?.hints;

const task = () => parseCatalog(pictures()).resources.find((r) => r.entity === "task")!;
/** The pinned capture's task field, with its `presentation` rewritten by `as`. */
function taskServed(as: (hints: Record<string, unknown>) => void): Entry {
  const doc = pictures();
  const resource = doc.resources.find((r: Record<string, unknown>) => r.entity === "task")!;
  const field = (resource.fields as Record<string, unknown>[]).find((f) => f.name === "status")!;
  const hints: Record<string, unknown> = (field.presentation as Record<string, unknown>) ?? {};
  field.presentation = hints;
  as(hints);
  return parseCatalog(doc).resources.find((r: Record<string, unknown>) => r.entity === "task")!;
}

test("the done values an entry declares are read, and say which rows finished", () => {
  const { entry, lines } = declaring(["done"]);
  assert.deepEqual(statusHints(entry)?.doneValues, ["done"]);
  assert.deepEqual(lines, [], "a well-formed hint says nothing");
  assert.deepEqual(finishedValues(entry), ["done"]);
  assert.equal(isFinished(entry, { status: "done" }), true);
  assert.equal(isFinished(entry, { status: "open" }), false);
});

test("a document that declares nothing finishes nothing, not even at a value that reads as done", () => {
  const { entry } = note(() => undefined);
  assert.equal(
    "hints" in (entry.fields.find((f) => f.name === "status") ?? {}),
    false,
    "an undeclared hint is absent from the parsed field, not an empty bag",
  );
  assert.deepEqual(finishedValues(entry), []);
  assert.equal(
    isFinished(entry, { status: "done" }),
    false,
    "the word a value happens to carry finishes nothing: only a declaration does",
  );
});

test("a done value the field's own enum does not hold is refused by name", () => {
  const { entry, lines } = declaring(["resolved"]);
  assert.deepEqual(lines, [
    'resources[0].fields[5].presentation.doneValues names "resolved", which is no value of this ' +
      "field: it is not finished",
  ]);
  assert.equal(statusHints(entry)?.doneValues, undefined);
  assert.deepEqual(finishedValues(entry), []);
  assert.equal(
    isFinished(entry, { status: "done" }),
    false,
    "the enum decides, never a string some other document happened to use",
  );
});

test("a malformed done list costs the celebration and the field nothing", () => {
  const malformed: readonly (readonly [unknown, readonly string[], string])[] = [
    [[], [], "names no value: nothing is finished"],
    ["done", [], "is not a list of this field's values: nothing is finished"],
    [["done", ""], ["done"], 'names "", which is no value of this field: it is not finished'],
    [["done", 7], ["done"], "names 7, which is no value of this field: it is not finished"],
  ];
  for (const [served, kept, why] of malformed) {
    const { entry, lines } = declaring(served);
    assert.deepEqual(finishedValues(entry), kept, `${JSON.stringify(served)} finished`);
    assert.equal(lines.length, 1, `${JSON.stringify(served)} noticed ${JSON.stringify(lines)}`);
    assert.ok(lines[0]!.endsWith(why), `${JSON.stringify(served)} noticed ${lines[0]}`);
    // The field itself survives its author's mistake: it is still this entry's state.
    assert.deepEqual(statusPill(entry, { status: "done" }, presentation)?.label, "Done");
  }
});

test("the entry's declaration is what makes a value celebrable, not a field's", () => {
  // The hint is served on the status field, but the entry never names that field as its state.
  const { entry } = note((e) => {
    const field = (e.fields as Record<string, unknown>[]).find((f) => f.name === "status")!;
    field.presentation = { doneValues: ["done"] };
  });
  assert.deepEqual(statusHints(entry)?.doneValues, ["done"], "the hint still parses");
  assert.deepEqual(finishedValues(entry), []);
  assert.equal(isFinished(entry, { status: "done" }), false);
});

test("a done value served on a field the entry does not read as its state is answered as nothing", () => {
  const { entry } = note((e) => {
    e.presentation = { statusField: "status" };
    const field = (e.fields as Record<string, unknown>[]).find((f) => f.name === "title")!;
    field.presentation = { ...(field.presentation ?? {}), doneValues: ["title"] };
  });
  assert.deepEqual(finishedValues(entry), [], "the phone consults the status field alone");
  assert.equal(isFinished(entry, { status: "done", title: "x" }), false);
});

test("the pinned capture's task is finished when it is resolved, and not when it is closed", () => {
  const entry = task();
  assert.deepEqual(finishedValues(entry), ["resolved"]);
  assert.equal(isFinished(entry, { status: "resolved" }), true);
  assert.equal(
    isFinished(entry, { status: "closed" }),
    false,
    "a closed task is not a finished one: the entity says so, and no neutral tone says otherwise",
  );
  assert.equal(isFinished(entry, { status: "in_progress" }), false);
});

test("which values finish and which colour finished wears are separate declarations", () => {
  const noTone = taskServed((h) => delete (h.enumTones as Record<string, unknown>).resolved);
  assert.equal(isFinished(noTone, { status: "resolved" }), true, "the mark still arrives");
  assert.equal(statusTone(noTone, { status: "resolved" }, presentation), "neutral");

  const noDone = taskServed((h) => {
    delete h.doneValues;
    (h.enumTones as Record<string, unknown>).resolved = "success";
  });
  assert.equal(isFinished(noDone, { status: "resolved" }), false, "nothing is celebrable");
  assert.equal(statusPill(noDone, { status: "resolved" }, presentation)?.tone, "ok");
});

test("a state kept off every screen, and a row holding no state, finish nothing", () => {
  const hidden = note((e) => {
    e.presentation = { statusField: "status" };
    const field = (e.fields as Record<string, unknown>[]).find((f) => f.name === "status")!;
    field.presentation = { visibility: "hidden", doneValues: ["done"] };
  });
  assert.equal(isFinished(hidden.entry, { status: "done" }), false);
  const declared = declaring(["done"]).entry;
  assert.equal(isFinished(declared, {}), false, "a row holding no value says no state");
  assert.equal(isFinished(declared, { status: "" }), false);
});

test("declaring done values changes no read this phone makes and no request it sends", () => {
  // Both entries name their state field; only one of them calls a value of it finished.
  const plain = note((e) => (e.presentation = { statusField: "status" })).entry;
  const declared = declaring(["done"]).entry;
  const row = { id: "1", title: "Buy milk", body: "Two litres", status: "done", rank: 2 };
  assert.equal(writePath(declared), writePath(plain));
  assert.deepEqual(
    values(formControls(declared, row, false), {}),
    values(formControls(plain, row, false), {}),
  );
  assert.deepEqual(
    rowCommands(declared).map((c) => c.verb),
    rowCommands(plain).map((c) => c.verb),
  );
  assert.deepEqual(
    listCells(declared).map((f) => f.name),
    listCells(plain).map((f) => f.name),
  );
});
