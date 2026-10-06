import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// A test says what behaviour it holds. Who asked for it — a review, a round —
// belongs to the commit that added it, not to the file a reader maintains.
test("the collection-address refusal test describes the rule, not who asked for its twin", () => {
  const text = readFileSync("tests/screens/collection-command-at-record-address.test.tsx", "utf8");
  const comments = [...text.matchAll(/^\s*\/\/.*$/gm)].map((m) => m[0].trim());
  assert.deepEqual(
    comments.filter((c) => /\breview(?:'s|er)?\b|\bround\s*\d/i.test(c)),
    [],
  );
});
