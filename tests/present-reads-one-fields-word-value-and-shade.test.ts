// `present` is what a declared pack screen is handed in place of calling the six
// free readings of `core/present` itself, so the rule it carries has to hold on its
// own, with no React and no screen in front of it. Three things are decided here: the
// word and the shade come from the resolved policy of the *one entry* the function was
// bound to, a value that policy says nothing about keeps today's humanising and no
// shade at all, and a name the entry carries no field for is answered with the name's
// own words rather than a guess at what the person meant.
import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import { presentFor } from "../src/core/present";
import { taskBlock } from "./fakes/policy";
import { feedback } from "./fakes/presentation";

/**
 * twoEntries is one document with the kernel's `task/task`, whose server resolved a
 * Portuguese policy, beside a `note/note` that resolved nothing. Two entries in one
 * document is the point: a reading that reached across to the other entry's fields, or
 * that read every field the same way whatever entry it was bound to, would answer both
 * halves of this file with the other half's words.
 */
function twoEntries(): { readonly task: Entry; readonly note: Entry } {
  const catalog = parseCatalog({
    catalogVersion: 3,
    resources: [
      {
        module: "task",
        entity: "task",
        path: "/api/v1/task/tasks",
        writable: true,
        fields: [
          { name: "id", type: "uuid", readOnly: true },
          { name: "title", type: "string" },
          { name: "description", type: "text" },
          { name: "priority", type: "string", enum: ["low", "normal", "high", "critical"] },
          { name: "status", type: "string", enum: ["open", "resolved"] },
          { name: "slaDeadline", type: "time", readOnly: true },
          { name: "slaBreached", type: "bool", readOnly: true },
        ],
        commands: [],
        resolved: taskBlock(),
      },
      {
        module: "note",
        entity: "note",
        path: "/api/v1/note/notes",
        writable: true,
        fields: [
          { name: "id", type: "uuid", readOnly: true },
          { name: "title", type: "string" },
          { name: "status", type: "string", enum: ["open", "done"] },
        ],
        commands: [],
      },
    ],
  } as never);
  return { task: catalog.resources[0]!, note: catalog.resources[1]! };
}

test("a value the policy labels wears the server's word and the shade it gave that value", () => {
  const { task } = twoEntries();
  const presented = presentFor(task, feedback)("status", "open");
  assert.equal(presented.label, "Estado");
  assert.equal(presented.value, "Em aberto");
  assert.equal(presented.tone, "warning");
});

test("a value the policy leaves unlabelled keeps today's words and no shade", () => {
  const { task } = twoEntries();
  const present = presentFor(task, feedback);
  // The same field, a value the resolved block names nothing for: the field's own
  // word stays, the value falls back to humanising, and no shade is invented.
  assert.deepEqual(present("status", "resolved"), {
    label: "Estado",
    value: "Resolved",
    tone: "neutral",
  });
  // A whole field no value of which the policy shades reads the same way.
  assert.deepEqual(present("priority", "high"), {
    label: "Prioridade",
    value: "High",
    tone: "neutral",
  });
});

test("a name the entry carries no field for is answered with the name's own words", () => {
  const { task } = twoEntries();
  const presented = presentFor(task, feedback)("slaReminder", "2026-03-14T09:00:00Z");
  // The words of the name, the value as it arrived and no shade: the same reading a
  // policy column naming no field is dropped with, and never an invented one.
  assert.equal(presented.label, "Sla reminder");
  assert.equal(presented.value, "2026-03-14T09:00:00Z");
  assert.equal(presented.tone, "neutral");
  assert.equal(presented.spoken, undefined);
});

test("a field handed over directly reads the same as that field named", () => {
  const { task } = twoEntries();
  const present = presentFor(task, feedback);
  const named = task.fields.find((f) => f.name === "status");
  assert.ok(named);
  // `Present` takes a name or the Field itself; the two are one rule, not two.
  assert.deepEqual(present(named, "open"), present("status", "open"));
});

test("present is bound to one entry and reads no other entry's fields", () => {
  const { task, note } = twoEntries();
  const presentTask = presentFor(task, feedback);
  const presentNote = presentFor(note, feedback);
  // `status` exists in both; only the entry whose policy resolved says "Estado",
  // and the entry with no resolved block keeps the words the field's name gives.
  assert.equal(presentTask("status", "open").label, "Estado");
  assert.equal(presentNote("status", "open").label, "Status");
  // A field only the other record carries is the no-field case for this one.
  assert.equal(presentNote("slaDeadline", "2026-03-14T09:00:00Z").label, "Sla deadline");
});

test("an instant says its whole date-time aloud while the cell keeps its own words", () => {
  const { task } = twoEntries();
  const presented = presentFor(task, feedback)("slaDeadline", "2026-03-14T09:00:00Z");
  assert.ok(presented.spoken, "an instant owes a reader the whole date-time");
  assert.match(presented.spoken, /2026/);
  assert.doesNotMatch(presented.value, /2026/);
  // Nothing else owes a second saying: what the eye reads is the whole fact.
  assert.equal(presentFor(task, feedback)("title", "Re-key the loading bay").spoken, undefined);
});
