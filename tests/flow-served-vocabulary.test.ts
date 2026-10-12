import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { flowFiles } from "../scripts/check_flows";

// The served kernel's vocabulary — which resource, its known field, which
// command and its argument — is named once, in the mobile-e2e job's env, and a
// flow reads it through ${MODULE}, ${KNOWN}, ${VERB}… A flow that spells one of
// those words itself fails the day the job names a different resource.
// `STATUS_VALUE` is the served vocabulary too, and deliberately not in this
// list: the journey taps that choice by its id and asserts the *word* the pill
// and the chip say, which is the phone's reading of the value and the assertion
// the journey exists to make. Spelling the id in a quoted string is what this
// test refuses, and the id is never quoted.
const SERVED = [
  "MODULE",
  "ENTITY",
  "KNOWN",
  "VERB",
  "VERB_FIELD",
  "DUE_FIELD",
  "STATUS_FIELD",
] as const;

test("a journey names the served kernel's vocabulary only through the job's variables", () => {
  const job = readFileSync(".gitea/workflows/mobile-e2e.yml", "utf8");
  const words = SERVED.map((name) => {
    const m = new RegExp(`^\\s+${name}: (\\S+)$`, "m").exec(job);
    assert.ok(m, `the job names ${name}`);
    return m[1]!.toLowerCase();
  });
  const spelled: string[] = [];
  for (const f of flowFiles(process.cwd())) {
    const steps = readFileSync(`e2e/flows/${f}`, "utf8").split(/^---\s*$/m)[1] ?? "";
    for (const m of steps.matchAll(/"([^"$]+)"/g))
      if (words.includes(m[1]!.toLowerCase())) spelled.push(`${f}: "${m[1]}"`);
  }
  assert.deepEqual(spelled, []);
});
