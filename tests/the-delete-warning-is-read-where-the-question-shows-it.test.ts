// The delete warning is the question's words: `kit.deleteWarning` is what
// `useResourceDetail.remove()` passes to `confirm` as the dialog's message, and
// no screen prints it before the delete row is tapped — the menu's Section has
// no footer, by the brief's own decision ("The footer 'Deleting cannot be
// undone.' goes"). A journey that reads the warning therefore opens the question
// first: the tap on `delete` comes before the sentence it shows. And at least
// one journey still reads it, because a flow that asserts changed copy keeps its
// behavioural coverage (AGENTS.md; the old footer assertion was that coverage).
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { kitEnglish } from "../src/core/kitCopy";

const FLOWS = "e2e/flows";

/** steps are a flow's journey lines, in order, after Maestro's `---` divider. */
function steps(file: string): readonly string[] {
  const lines = readFileSync(path.join(FLOWS, file), "utf8").split(/\r?\n/);
  return lines.slice(lines.findIndex((l) => /^---\s*$/.test(l)) + 1);
}

test("a flow reads the delete warning after the tap that opens the question", () => {
  const flows = readdirSync(FLOWS).filter((f) => /\.ya?ml$/.test(f));
  let read = 0;
  for (const file of flows) {
    const lines = steps(file);
    const warningAt = lines.findIndex((l) => l.includes(kitEnglish.deleteWarning));
    if (warningAt === -1) continue;
    read += 1;
    const questionOpenedAt = lines.findIndex(
      (l, i) =>
        i < warningAt && /^\s*id:\s*"?delete"?\s*$/.test(l) && /tapOn/.test(lines[i - 1] ?? ""),
    );
    assert.notEqual(
      questionOpenedAt,
      -1,
      `${file}: reads the delete warning (line ${warningAt + 1} of its steps) before any ` +
        "tap on the delete row, and the warning is on no screen until that tap opens the question",
    );
  }
  assert.ok(read > 0, "no flow reads the delete warning: the footer's coverage was not kept");
});
