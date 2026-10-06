// The repository's required check has to keep running both suites: these pins read
// package.json and jest.config.js and refuse a script, a testMatch or a worker pool
// that would quietly stop discovering the component suites, and refuse a Node glob or a
// discovered Node file that stopped holding a case of its own.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

test("the required check runs the bounded component suite", () => {
  const scripts = (require("../package.json") as { scripts: Record<string, string> }).scripts;
  const config = require("../jest.config.js") as {
    maxWorkers?: unknown;
    testMatch?: string[];
  };

  assert.match(scripts.check ?? "", /(?:^|&&)\s*npm run test(?:\s|$)/);
  assert.match(scripts.test ?? "", /(?:^|&&)\s*jest(?:\s|$)/);
  assert.equal(config.maxWorkers, 1);
  assert.ok(config.testMatch?.includes("<rootDir>/tests/**/*.test.tsx"));
});

test("the Node suite still runs by the glob its counts were taken from, over files that hold cases", () => {
  const scripts = (require("../package.json") as { scripts: Record<string, string> }).scripts;
  // Jest discovery is pinned above; the core derivations run under the other half of the same
  // script. A glob that stopped matching would leave the required check green with none of them.
  assert.match(scripts.test ?? "", /node --import tsx --test tests\/\*\.test\.ts/);
  // A file the glob reaches that holds no case — an import of another file, for instance — is
  // counted as a case by nothing and hides whatever moved out of it.
  const holdsNoCase = readdirSync(new URL("../tests/", import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^[^/]+\.test\.ts$/.test(entry.name))
    .filter(
      (entry) =>
        !/(^|[^.\w])(test|describe)\s*\(/.test(
          readFileSync(new URL(`../tests/${entry.name}`, import.meta.url), "utf8"),
        ),
    )
    .map((entry) => entry.name);
  assert.deepEqual(holdsNoCase, [], "a discovered Node test file has to hold a case of its own");
});
