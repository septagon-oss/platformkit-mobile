import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Run visual_review.py against the current served gallery first. These are its
// fresh reports, supplied by the capture runner, not a committed golden verdict.
test("every captured gallery batch reaches wow without high or medium findings", () => {
  const paths = JSON.parse(process.env.GALLERY_VISUAL_REPORTS ?? "[]");
  assert.ok(
    paths.length > 0,
    "supply GALLERY_VISUAL_REPORTS as a JSON array of fresh report paths",
  );
  const failures = [];
  for (const path of paths) {
    const report = readFileSync(path, "utf8");
    const verdicts = [...report.matchAll(/verdict: \*\*(wow|floor|below)\*\*/g)].map(
      (match) => match[1],
    );
    if (!verdicts.length || verdicts.some((verdict) => verdict !== "wow")) {
      failures.push(`${path}: verdicts ${JSON.stringify(verdicts)}`);
    }
    const unresolved = report.split("\n").filter((line) => /^- \[(high|medium)\]/i.test(line));
    failures.push(...unresolved.map((line) => `${path}: ${line}`));
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});
