import assert from "node:assert/strict";
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
