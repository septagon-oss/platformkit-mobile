import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("the current gallery meets its captured reference bar", () => {
  // Compose the existing verdict, coverage and source-freshness checks. The
  // capture runner supplies real reports; no golden verdict stands in for them.
  const captureEnv = { ...process.env };
  // The child needs its own test runner, rather than the parent's worker context.
  delete captureEnv.NODE_TEST_CONTEXT;
  const result = spawnSync(
    process.execPath,
    ["--test", fileURLToPath(new URL("./gallery-visual-acceptance.case.mjs", import.meta.url))],
    { encoding: "utf8", timeout: 60000, env: captureEnv },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
