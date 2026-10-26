// A finite choice answers one question, and the catalogue decides whether that question takes
// one answer or an ordered set of them. These cases hold the two shapes and the three rules that
// decide what a tap does: the exclusive "No preference" answer stands alone, a declared maximum
// either gives up its oldest answer or refuses the tap, and a tap that changes nothing writes
// nothing. Every case is built from the pinned capture's own answers.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Field } from "../src/core/catalog";
import { deriveChoices, pickChoice, type Choice, type ChoiceGroupModel } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

const value = <T>(result: { ok: true; value: T } | { ok: false; issues: unknown }): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

/** The pinned capture's declared choice, as this build reads it. */
const shapes = (): NonNullable<Field["choice"]> =>
  parseCatalog(JSON.parse(readFileSync("testdata/catalog.choices.json", "utf8"))).resources[0]!
    .fields[0]!.choice!;

const held = (
  choice: NonNullable<Field["choice"]>,
  selectedIds: readonly string[],
): ChoiceGroupModel =>
  value(
    deriveChoices(
      {
        id: "shapes",
        label: "Shapes",
        choices: choice.answers.map((a): Choice => ({
          id: a.id,
          label: a.label,
          enabled: true,
          ...(a.picture === undefined ? {} : { picture: a.picture }),
          ...(a.exclusive === undefined ? {} : { exclusive: a.exclusive }),
        })),
        required: choice.answerless === undefined,
        ...(choice.many ? { many: true, selectedIds } : { selectedId: selectedIds[0] }),
        ...(choice.maximum === undefined ? {} : { maximum: choice.maximum }),
        ...(choice.answerless === undefined ? {} : { answerless: true }),
        ...(choice.reason === undefined ? {} : { reason: choice.reason }),
      },
      presentation,
    ),
  );

test("one answer is a word and many are an ordered set", () => {
  const one = held({ ...shapes(), many: false }, ["square"]);
  assert.equal(one.many, false);
  assert.deepEqual(one.selectedIds, ["square"]);
  assert.deepEqual(
    one.choices.filter((c) => c.selected).map((c) => c.id),
    ["square"],
  );
  const many = held(shapes(), ["square", "round"]);
  assert.equal(many.many, true);
  assert.deepEqual(many.selectedIds, ["square", "round"], "the order a person chose in is kept");
});

test("a group that spells its answer the wrong way for its cardinality is refused by name", () => {
  const build = (input: unknown) => deriveChoices(input as never, presentation);
  const base = { id: "s", label: "Shapes", choices: [{ id: "a", label: "A", enabled: true }] };
  assert.equal(build({ ...base, many: true, selectedId: "a" }).ok, false);
  assert.equal(build({ ...base, selectedIds: ["a"] }).ok, false);
  assert.equal(build({ ...base, many: true, selectedIds: ["a", "a"] }).ok, false);
  const wrong = build({ ...base, many: true, selectedIds: ["a", "a"] });
  assert.ok(!wrong.ok);
  assert.deepEqual(
    wrong.issues.map((i: { path: string }) => i.path),
    ["selectedIds"],
  );
});

test("tapping an answer in a many-answer choice adds it, and tapping it again lets it go", () => {
  const start = held(shapes(), ["round"]);
  const added = pickChoice(start, "square");
  assert.deepEqual(added, ["round", "square"]);
  const dropped = pickChoice(held(shapes(), ["round", "square"]), "round");
  assert.deepEqual(dropped, ["square"]);
});

test("tapping an answer in a single-answer choice replaces it, and tapping the held answer changes nothing", () => {
  const start = held({ ...shapes(), many: false }, ["round"]);
  assert.deepEqual(pickChoice(start, "square"), ["square"]);
  assert.deepEqual(pickChoice(start, "round"), ["round"]);
});

test("the exclusive answer stands alone, and any other answer lets it go", () => {
  const start = held(shapes(), ["round", "square"]);
  assert.equal(start.exclusiveId, "none");
  assert.deepEqual(pickChoice(start, "none"), ["none"]);
  const alone = held(shapes(), ["none"]);
  assert.deepEqual(pickChoice(alone, "round"), ["round"]);
  assert.deepEqual(pickChoice(alone, "none"), []);
});

test("a maximum that replaces gives up its oldest answer, and one without the word refuses the tap", () => {
  // The capture's third answer is the exclusive one, which would stand alone rather than join a
  // fourth; this case needs four plain answers to fill a maximum of two.
  const answers = shapes().answers.map((a) => ({ ...a, exclusive: undefined }));
  const four: Choice[] = [
    ...answers.map((a) => ({ id: a.id, label: a.label, enabled: true })),
    { id: "flat", label: "Flat", enabled: true },
  ];
  const group = (maximum: { count: number; replacesOldest?: true }) =>
    value(
      deriveChoices(
        {
          id: "shapes",
          label: "Shapes",
          choices: four,
          required: true,
          many: true,
          selectedIds: ["round", "square"],
          maximum,
        },
        presentation,
      ),
    );
  assert.deepEqual(pickChoice(group({ count: 2, replacesOldest: true }), "none"), [
    "square",
    "none",
  ]);
  assert.deepEqual(pickChoice(group({ count: 2 }), "none"), ["round", "square"]);
  assert.equal(group({ count: 2, replacesOldest: true }).full, true);
});

test("an empty answer the server refuses is unsatisfied with its own sentence", () => {
  const refused = held(shapes(), []);
  assert.equal(refused.satisfied, false);
  assert.equal(refused.reason, "Keep one shape.");
  const allowed = held({ ...shapes(), answerless: true as const }, []);
  assert.equal(allowed.satisfied, true);
});

test("an answer that is no longer offered is said, and the question stays unsatisfied", () => {
  const model = value(
    deriveChoices(
      {
        id: "shapes",
        label: "Shapes",
        choices: [
          { id: "round", label: "Round", enabled: false, reason: "Retired" },
          { id: "square", label: "Square", enabled: true },
        ],
        many: true,
        selectedIds: ["round"],
        required: true,
      },
      presentation,
    ),
  );
  assert.equal(model.satisfied, false);
  assert.equal(model.issue?.code, "unavailable");
  assert.deepEqual(pickChoice(model, "round"), ["round"], "a retired answer is not tapped");
});

test("a question with nothing held and nothing required is answered by holding nothing", () => {
  const model = held({ ...shapes(), answerless: true as const }, []);
  assert.equal(model.canClear, false);
  assert.equal(pickChoice(model, "round").length, 1);
});
