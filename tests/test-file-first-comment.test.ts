// A reader learns what a test file protects from its name and its first comment: these files hold
// the shared-kit, state and activity rules other files were folded into, so each opens by saying
// which rules those are before it imports anything.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("a test file states the rules it holds before it imports", () => {
  const silent = [
    "tests/activity.test.ts",
    "tests/feedback.test.ts",
    "tests/shared-kit.test.ts",
    "tests/ui/feedback.test.tsx",
  ].filter((file) => {
    const first = readFileSync(path.join(root, file), "utf8")
      .split("\n")
      .find((line) => line.trim() !== "");
    return !/^\s*(\/\/|\/\*)/.test(first ?? "");
  });
  assert.deepEqual(silent, [], "these files open with an import instead of their rule");
});
