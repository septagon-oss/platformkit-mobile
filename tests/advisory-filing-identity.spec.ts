import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { checkAdvisories } from "../scripts/advisories";

const root = path.resolve(import.meta.dirname, "..");
const lock: unknown = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
const empty = { schema: 1, reviews: [] };

// A filing the gate cannot name is a filing it cannot have reviewed: whether
// the database points at a mirror or spells the id another way, a high filing
// must stop the run rather than vanish from what the gate compares.
test("a high filing whose advisory id cannot be read is refused, never skipped", () => {
  for (const url of [
    "https://www.npmjs.com/advisories/1179",
    "https://github.com/advisories/GHSA-QWER-ASDF-ZXCV",
    "",
  ]) {
    const audit = {
      auditReportVersion: 2,
      vulnerabilities: {
        "brace-expansion": {
          via: [{ name: "brace-expansion", severity: "high", title: "expansion hangs", url }],
        },
      },
    };
    assert.throws(
      () => checkAdvisories({ audit, record: empty, lock, today: "2026-10-02" }),
      /brace-expansion url/,
      `a high filing at ${JSON.stringify(url)} passed the gate`,
    );
  }
});
