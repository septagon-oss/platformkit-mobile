// These cases hold the nightly's bound to what `startBound` says it is: a timer the
// process keeps. A process whose only pending work is the bound must stay alive until
// the bound fires and aborts with its own reason — `AbortSignal.timeout` does not, on
// the Node the ci job runs — and a bound that is put down must not keep the process
// waiting out the budget. Each case runs in a child process of its own, because the
// test runner's loop would otherwise hold the process open and prove nothing.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { startBound } from "../scripts/kernel_main";

const root = path.resolve(import.meta.dirname, "..");

/** alone runs `body` in a fresh process with nothing pending but what `body` starts. */
function alone(body: string): { status: number | null; stdout: string; ms: number } {
  const started = Date.now();
  const run = spawnSync(
    process.execPath,
    [
      "--import",
      createRequire(import.meta.url).resolve("tsx"),
      "--input-type=module",
      "-e",
      `import { startBound } from ${JSON.stringify(path.join(root, "scripts/kernel_main.ts"))};\n${body}`,
    ],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
  );
  return { status: run.status, stdout: run.stdout, ms: Date.now() - started };
}

test("a bound that is the only pending work keeps the process until it fires", () => {
  const run = alone(
    `const b = startBound(300);
     b.signal.addEventListener("abort", () => console.log("aborted " + b.signal.reason.name));`,
  );
  assert.equal(run.status, 0);
  assert.equal(run.stdout.trim(), "aborted TimeoutError");
});

test("a bound that is put down lets the process end at once rather than wait out the budget", () => {
  const run = alone(
    `const b = startBound(30_000);
     b.signal.addEventListener("abort", () => console.log("aborted"));
     b.end();
     console.log("ended");`,
  );
  assert.equal(run.status, 0);
  assert.equal(run.stdout.trim(), "ended");
  assert.ok(run.ms < 15_000, `the process waited ${String(run.ms)}ms after its bound was put down`);
});

test("no budget is no bound, and putting it down is harmless", () => {
  const b = startBound(undefined);
  assert.equal(b.signal, undefined);
  b.end();
});
