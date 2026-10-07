// The command refuses an unrepresentable timer budget before reading the forge,
// while both ends of the supported interval remain usable configuration.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fromEnv } from "../scripts/kernel_main";

test("the shipped command refuses a timer overflow as configuration", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const result = spawnSync(
    process.execPath,
    ["--import", createRequire(import.meta.url).resolve("tsx"), "scripts/kernel_main.ts"],
    {
      cwd: root,
      env: {
        ...process.env,
        PK_KERNEL_SERVER: "http://127.0.0.1:1",
        PK_KERNEL_REPOSITORY: "example/kernel",
        GITHUB_TOKEN: "budget-test-token",
        PK_KERNEL_TIMEOUT_MS: "2147483648",
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    },
  );
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /PK_KERNEL_TIMEOUT_MS.*2147483648.*above.*2147483647/);
  assert.doesNotMatch(result.stderr, /TimeoutOverflowWarning|GET |budget-test-token/);
});

test("the smallest and largest timer budgets survive environment parsing exactly", () => {
  for (const milliseconds of [1, 2_147_483_647]) {
    const deps = fromEnv({ PK_KERNEL_TIMEOUT_MS: String(milliseconds) });
    assert.equal(deps.timeoutMs, milliseconds);
  }
});
