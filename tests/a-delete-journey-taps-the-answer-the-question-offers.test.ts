// The delete question answers in the kit's words: `kit.deleteAction(singular)` labels
// the button — "Delete note", "Delete task" — so the word the journey used to tap, a
// bare "Delete", is no longer the whole answer, and the noun belongs to whichever
// resource the CI job names through ${MODULE}/${ENTITY}. A journey therefore taps the
// *shape* of the answer: Maestro's pattern spelling, read here against the sentence the
// copy table actually draws. One implementation of the rule — the test reads the words
// from `kitCopy`, never restates them — and it refuses a flow that taps the old word,
// one that spells one resource's noun, and one that cannot tell the answer from the
// question above it, which is the same two words and a quoted name.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { kitEnglish } from "../src/core/kitCopy";
import { flowFiles } from "../scripts/check_flows";

const FLOWS = "e2e/flows";
/** PATTERN is Maestro's spelling of a pattern in a text selector: the expression between two slashes. */
const PATTERN = /^\/(.*)\/$/s;
/** DELETED is the tap on the menu's row: the `id: delete` line the `tapOn:` above it owns. */
const DELETED = /^\s*id:\s*"?delete"?\s*$/;

/** steps are a flow's journey lines, in order, after Maestro's `---` divider. */
function steps(file: string): readonly string[] {
  const lines = readFileSync(path.join(FLOWS, file), "utf8").split(/\r?\n/);
  return lines.slice(lines.findIndex((l) => /^---\s*$/.test(l)) + 1);
}

/**
 * toRegExp builds an expression from Maestro's spelling. Java reads a leading `(?i)`
 * as "ignore case", which is the flag JavaScript spells after the literal, and
 * Maestro's own text match ignores case — so a pattern written to answer either way a
 * dialog renders its button's letters is read either way here too.
 */
function toRegExp(pattern: string): RegExp {
  const ignoresCase = pattern.startsWith("(?i)");
  return new RegExp(ignoresCase ? pattern.slice(4) : pattern, ignoresCase ? "i" : "");
}

test("a journey that deletes taps the answer by its shape, not by a noun it spells", () => {
  const drawn = kitEnglish.deleteAction("note");
  let asked = 0;
  for (const file of flowFiles(process.cwd())) {
    const lines = steps(file);
    const tapped = lines.findIndex((l, i) => DELETED.test(l) && /tapOn/.test(lines[i - 1] ?? ""));
    if (tapped === -1) continue;
    asked += 1;
    const line = lines.slice(tapped + 1).find((l) => /^\s*-\s*tapOn:/.test(l));
    assert.ok(line, `${file}: taps the delete row and never answers the question it opens`);
    const selector = (/^\s*-\s*tapOn:\s*(.*)$/.exec(line)![1] ?? "").trim();
    const quoted = PATTERN.exec(selector.replace(/^["'](.*)["']$/, "$1"));
    assert.ok(
      quoted,
      `${file}: taps ${selector} — the answer is labelled "${drawn}", whose noun is the served ` +
        "resource's, so the journey matches its shape between slashes",
    );
    const re = toRegExp(quoted[1]!);
    assert.ok(re.test(drawn), `${file}: ${selector} misses the answer the kit draws ("${drawn}")`);
    // The match is the whole answer: Maestro may read a text pattern as a whole-string
    // match or as a search, and an anchored pattern answers both the same way.
    assert.equal(
      drawn.match(re)?.[0] ?? "",
      drawn,
      `${file}: ${selector} matches part of "${drawn}"`,
    );
    assert.ok(
      re.test(kitEnglish.deleteAction("task item")),
      `${file}: ${selector} misses an answer whose noun is two words`,
    );
    assert.ok(
      !re.test(kitEnglish.deleteQuestion("Renew the shared drive licence")),
      `${file}: ${selector} also matches the question ("${kitEnglish.deleteQuestion("x")}") ` +
        "drawn above the answer, so the tap could land on the sentence instead",
    );
    assert.ok(
      !re.test(kitEnglish.deleteWarning),
      `${file}: ${selector} also matches the warning it is reading`,
    );
  }
  assert.ok(asked > 0, "no journey answers the delete question: deleting is covered nowhere");
});
