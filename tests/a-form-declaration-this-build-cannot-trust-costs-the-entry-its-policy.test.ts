// A stepped declaration this build cannot trust costs the entry its policy, one sentence,
// exactly as every other part of the block does. Each case breaks one member of the kernel's
// own three-step form and refuses: the phone will not guess a layout, complete a step list or
// wear a verb it cannot fill.
import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { steppedNote } from "./fakes/steps";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const read = (mutate: (note: Json) => void) => {
  const notices: string[] = [];
  const entry = parseCatalog(steppedNote(mutate), (at, why) => notices.push(`${at} ${why}`))
    .resources[0]!;
  return { entry, notices };
};
const form = (note: Json): Json => note.resolved.layout.forms.createForm;

/** The kernel's own refusals: one broken member, one sentence, no policy at all. */
const malformed: readonly [string, (note: Json) => void, RegExp][] = [
  ["a layout this build does not know", (r) => (form(r).layout = "wizard"), /laid out as "wizard"/],
  [
    "steps with no layout word",
    (r) => ((form(r).layout = ""), (form(r).steps = [])),
    /laid out as ""/,
  ],
  ["a nil step list", (r) => (form(r).steps = null), /states no step/],
  ["an empty step list", (r) => (form(r).steps = []), /states no step/],
  [
    "a repeated step key",
    (r) => (form(r).steps[1].key = "unsectioned"),
    /repeats the step unsectioned/,
  ],
  [
    "a step that asks no field",
    (r) => (form(r).steps[1].fields = []),
    /step section:details of createForm asks no field/,
  ],
  [
    "one field on two steps",
    (r) => form(r).steps[1].fields.push("title"),
    /asks the field title on two steps/,
  ],
  [
    "a create field no step asks",
    (r) => (form(r).steps[2].fields = ["pinned"]),
    /does not ask exactly the fields it edits \(tags\)/,
  ],
  [
    "a step that asks a field the form does not edit",
    (r) => form(r).steps[2].fields.push("status"),
    /does not ask exactly the fields it edits \(status\)/,
  ],
  [
    "a step whose verb says nothing",
    (r) => (form(r).steps[0].primaryLabel = "  "),
    /step unsectioned of createForm names no primary label/,
  ],
  [
    "a verb wearing two answers",
    (r) => (form(r).steps[0].primaryLabel = "{answer} · {answer}"),
    /more than one answer token/,
  ],
  [
    "a token this build does not fill",
    (r) => (form(r).steps[0].primaryLabel = "Next · {other}"),
    /a token it does not fill/,
  ],
  [
    "an answer field off its own step",
    (r) => {
      form(r).steps[1].primaryLabel = "Next · {answer}";
      form(r).steps[1].answerField = "title";
    },
    /step section:details of createForm wears its answer token for a field it does not ask/,
  ],
  [
    "an answer with no empty label",
    (r) => (form(r).steps[0].emptyLabel = ""),
    /wears its answer token with no empty label/,
  ],
  [
    "a literal verb with answer properties",
    (r) => (form(r).steps[2].answerField = "pinned"),
    /wears a literal label and answer properties/,
  ],
];

for (const [said, break_, names] of malformed) {
  test(`a stepped form with ${said} costs the entry its policy and says so once`, () => {
    const { entry, notices } = read(break_);
    assert.equal(notices.length, 1, notices.join("; "));
    assert.match(notices[0]!, /resources\[0\]\.resolved/);
    assert.match(notices[0]!, names);
    assert.match(
      notices[0]!,
      /: the entry is drawn without the server's policy$/,
      "the door's own ending, the one every policy refusal wears",
    );
    assert.equal(entry.resolved, undefined, "a refused block leaves no half-read policy");
  });
}

test("a step pointing at a name the entry has no field of is refused as a pointer", () => {
  // Not a step judgement: a field name is a pointer into this entry, and one that
  // answers nothing means the block was resolved against another schema entirely.
  const { entry, notices } = read((r) => (form(r).steps[0].fields = ["nope"]));
  assert.equal(notices.length, 1);
  assert.match(notices[0]!, /names the unknown field nope/);
  assert.equal(entry.resolved, undefined);
});

test("the same form with nothing broken about it is read whole", () => {
  const { entry, notices } = read(() => {});
  assert.deepEqual(notices, []);
  assert.notEqual(entry.resolved, undefined);
});
