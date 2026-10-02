import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

test("the component suites run in a worker pool the repository fixes, not one the machine sizes", () => {
  const config = require("../jest.config.js") as { maxWorkers?: unknown };
  assert.equal(config.maxWorkers, 1);
  const scripts = (require("../package.json") as { scripts: Record<string, string> }).scripts;
  for (const [name, script] of Object.entries(scripts)) {
    assert.doesNotMatch(script, /--maxWorkers|\bjest\b.*\s-w\b/, `${name} resizes the pool`);
  }
});
