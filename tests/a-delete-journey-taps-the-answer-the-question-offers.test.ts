// Tapping the menu's Delete row opens a question the journey must answer: the delete is the
// run's own tidying, and a flow that leaves the question standing fails at its next step for a
// reason that says nothing about the screen it was proving. So every journey the workspace
// plans — the plan, not a list of names — that taps `delete` goes on to answer it, and answers
// it by the answer's *words*: the button carries the record's own noun ("Delete note",
// "Delete task"), which a journey that names the served resource through ${MODULE}/${ENTITY}
// cannot spell, and which no node id promises. Pointing at a node instead is refused here.
//
// Two rules live here, and neither is the words' meaning. `delete-selectors-match-the-dialog-answer.test.ts`
// reads each enumerated journey's selector as the regex source Maestro takes it for and matches
// it against what `kitCopy` draws; what is checked below is that a journey reaches and answers
// its question, and that every journey that does is enumerated *there*, so a seventh delete
// journey cannot slip through with words nobody matched. And at least one journey deletes,
// because deleting is how these journeys leave the server as they found it, which is the
// behavioural coverage AGENTS.md keeps for copy a change replaced.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { kitEnglish } from "../src/core/kitCopy";
import { flowFiles } from "../scripts/check_flows";

const FLOWS = "e2e/flows";
/** SELECTED is the file that matches a delete answer's words against the copy table. */
const SELECTED = "tests/delete-selectors-match-the-dialog-answer.test.ts";
/** DELETED is the tap on the menu's row: the `id: delete` line the `tapOn:` above it owns. */
const DELETED = /^\s*id:\s*"?delete"?\s*$/;
/** TAPPED is a step that taps something: a scalar after the colon, or a block under it. */
const TAPPED = /^[ ]*-[ ]+tapOn:(?:[ ](.*\S))?$/;

/** steps are a flow's journey lines, in order, after Maestro's `---` divider. */
function steps(file: string): readonly string[] {
  const lines = readFileSync(path.join(FLOWS, file), "utf8").split(/\r?\n/);
  return lines.slice(lines.findIndex((l) => /^---\s*$/.test(l)) + 1);
}

/**
 * answers lists, for each planned journey, the file and the step that answers a delete
 * question — every journey that taps the menu's row, whether or not it then answers it.
 */
function deleteJourneys(): {
  file: string;
  answer: string | undefined;
  block: readonly string[];
}[] {
  const journeys: { file: string; answer: string | undefined; block: readonly string[] }[] = [];
  for (const file of flowFiles(process.cwd())) {
    const lines = steps(file);
    const opened = lines.findIndex((l, i) => DELETED.test(l) && /tapOn/.test(lines[i - 1] ?? ""));
    if (opened === -1) continue;
    const at = lines.findIndex((l, i) => i > opened && TAPPED.test(l));
    if (at === -1) {
      journeys.push({ file, answer: undefined, block: [] });
      continue;
    }
    // `tapOn:` with nothing after it puts its selector on the indented lines below it.
    const below = lines.slice(at + 1);
    const ends = below.findIndex((l) => l.trim() !== "" && !/^[ ]{4,}\S/.test(l));
    journeys.push({
      file,
      answer: TAPPED.exec(lines[at]!)![1]?.trim(),
      block: ends === -1 ? below : below.slice(0, ends),
    });
  }
  return journeys;
}

test("a journey that opens the delete question answers it by its words, not by a node", () => {
  const drawn = kitEnglish.deleteAction("note");
  for (const { file, answer, block } of deleteJourneys()) {
    assert.notEqual(
      answer,
      undefined,
      `${file}: taps the menu's delete row and never answers the question that opens — the run ` +
        "leaves its own question standing and fails at its next step for a reason that names nothing",
    );
    if (answer === "")
      assert.ok(
        block.some((l) => /^[ ]+text:/.test(l)) && !block.some((l) => /^[ ]+id:/.test(l)),
        `${file}: answers the delete question by pointing at a node. The button carries the ` +
          `record's own noun ("${drawn}"), which the journey cannot spell from what the job names, ` +
          "so it is found by the shape of its words",
      );
  }
});

test("every journey that answers a delete question is one whose words were matched", () => {
  const deleting = deleteJourneys().map((j) => j.file);
  assert.ok(
    deleting.length > 0,
    "no journey answers the delete question: deleting is covered nowhere",
  );
  // The selector test enumerates the journeys it matches; the list is read from that
  // file rather than copied, so the two cannot drift apart by a name.
  const listed = /\[[ \t]*(?:"[a-z0-9-]+"[ \t*,]+)*"[a-z0-9-]+"[ \t]*\]/.exec(
    readFileSync(SELECTED, "utf8"),
  );
  assert.ok(listed, `${SELECTED}: enumerates no journeys, so nothing matches a delete answer`);
  const matched = new Set([...listed[0]!.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]!));
  const unwatched = deleting.filter((f) => !matched.has(f.replace(/\.ya?ml$/, "")));
  assert.deepEqual(
    unwatched,
    [],
    `${unwatched.join(", ")} answer a delete question no check matches against ${path.basename(SELECTED)} — ` +
      "name the journey there, beside the journeys whose words that file reads",
  );
});
