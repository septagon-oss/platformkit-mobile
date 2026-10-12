// The history scan's exemption is matched against the secret a rule captured, not
// against the line that holds it. gitleaks reads `regexTarget = "line"` as "swallow
// every finding on a line the shape appears on", so a real credential written beside
// the release fixture would pass the scan. Held here: the exemption states no target
// other than the secret, no stopword and no second allowlist table.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const document = readFileSync(path.join(root, ".gitleaks.toml"), "utf8");
const stated = document
  .split("\n")
  .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"));

test("the scan's exemption is matched against the captured secret, not its line", () => {
  const targets = stated.filter((line) => /^\s*regexTarget\s*=/.test(line));
  for (const line of targets) assert.match(line, /=\s*"secret"\s*$/, line);
  assert.ok(
    stated.every((line) => !/^\s*stopwords\s*=/.test(line)),
    "a stopword swallows every secret that contains it",
  );
  assert.equal(
    stated.filter((line) => /^\s*\[\[?allowlists?\]\]?\s*$/.test(line)).length,
    1,
    "one allowlist table holds the one exemption",
  );
});
