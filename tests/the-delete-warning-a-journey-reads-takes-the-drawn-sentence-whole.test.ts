// Maestro reads an assertVisible text as regex source and matches it against the
// whole of an element's text, the same reading that takes the delete answer's
// tapOn. The placement test compares the warning's letters to the copy table; it
// says nothing about how those letters match. Today the sentence's only
// metacharacter is `.`, which takes itself, but a copy change that adds `?` or
// `*` would keep every letter-comparison green while the device assertion
// silently stops finding the sentence. So the words a delete journey reads
// between opening the question and answering it are pinned as they are matched:
// compiled as regex source, taking the drawn sentence whole.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { kitEnglish } from "../src/core/kitCopy";
import { flowFiles } from "../scripts/check_flows";

const FLOWS = "e2e/flows";
/** READ is a step that reads words on the screen: `- assertVisible: <scalar>`. */
const READ = /^[ ]*-[ ]+assertVisible:[ ]*(.*\S)[ ]*$/;
/** ANSWERED is the step that answers the question: the next tap after the row. */
const ANSWERED = /^[ ]*-[ ]+tapOn:/;

/** unquoted resolves the one pair of YAML quotes the matcher never sees. */
function unquoted(value: string): string {
  const quote = value[0] === '"' || value[0] === "'" ? value[0] : null;
  return quote !== null && value.length > 1 && value.endsWith(quote) ? value.slice(1, -1) : value;
}

test("the delete warning a journey reads takes the drawn sentence whole", () => {
  const drawn = kitEnglish.deleteWarning;
  let read = 0;
  for (const file of flowFiles(process.cwd())) {
    const lines = readFileSync(path.join(FLOWS, file), "utf8").split(/\r?\n/);
    const opened = lines.findIndex(
      (l, i) => /^\s*id:\s*"?delete"?\s*$/.test(l) && /tapOn/.test(lines[i - 1] ?? ""),
    );
    if (opened === -1) continue;
    for (const line of lines.slice(opened + 1)) {
      if (ANSWERED.test(line)) break;
      const step = READ.exec(line);
      if (!step) continue;
      read += 1;
      // Translate Java's inline case flag only; preserve every other character,
      // as the matcher of the answer's own selector is read.
      const regex = new RegExp(unquoted(step[1]!).replaceAll("(?i)", ""), "is");
      assert.equal(
        regex.exec(drawn)?.[0],
        drawn,
        `${file}: reads ${step[1]!} between the question and its answer, and Maestro compiles ` +
          `those words as regex source matched against the whole sentence — they do not take ` +
          `${JSON.stringify(drawn)}`,
      );
    }
  }
  assert.ok(read > 0, "no journey reads a sentence after opening the delete question");
});
