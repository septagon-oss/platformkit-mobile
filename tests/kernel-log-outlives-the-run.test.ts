import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

// The served kernel's log is the only record of a run whose server answered
// nothing, and the harness writes it inside a work directory its EXIT trap deletes
// — so the one process that could explain a journey is gone before the job's next
// step can say anything about it. The trap keeps that log where the report already
// lives, for whichever exit status, and keeps nothing else from that directory: the
// config, the cookie jars and the recovery codes hold this run's keys in live form.
// The trap's own body is what runs here, extracted from the script, with a planted
// work directory: psql is stubbed and no server, device or database is started.

const cleanup = (): string => {
  const ci = readFileSync(path.join(import.meta.dirname, "..", "scripts/e2e/mobile_ci.sh"), "utf8");
  const body = /\ncleanup\(\) \{([\s\S]*?)\n\}\n/.exec(ci)?.[1];
  assert.ok(body, "the harness has one cleanup trap");
  return body;
};

/**
 * teardown plants a work directory as the harness leaves one — the kernel's log,
 * its config, its cookie jars and its recovery codes — runs the trap against a
 * report path beside it, and reports where each landed.
 */
function teardown(t: TestContext): {
  status: number | null;
  root: string;
  kept: string;
  log: string;
} {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-kernel-log-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const work = path.join(root, "work");
  const out = path.join(root, "e2e", "out");
  const report = path.join(out, "report.xml");
  mkdirSync(work, { recursive: true });
  writeFileSync(
    path.join(work, "app.log"),
    "kernel: listen tcp :8098: bind: address already in use\n",
  );
  writeFileSync(path.join(work, "config.yaml"), "auth:\n  factor_key: a-key-nobody-may-keep\n");
  writeFileSync(path.join(work, "codes.json"), '{"codes":["a-recovery-code"]}\n');
  writeFileSync(path.join(work, "admin.jar"), "a session cookie\n");
  const result = spawnSync(
    "bash",
    [
      "-c",
      `work="$1"
app_pid=""
created=true
database=platformkit_mobile_fixture
psql_admin() { :; }
cleanup() {${cleanup()}
}
(exit 3)
cleanup
printf 'cleanup_status=%s\\n' "$?"
printf 'left=%s\\n' "$(ls -A "$work" 2>/dev/null || echo gone)"`,
      "trap-test",
      work,
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 20000,
      env: { ...process.env, PK_MOBILE_REPORT: report },
    },
  );
  assert.equal(
    result.error,
    undefined,
    `the trap must answer inside its timeout: ${result.stderr}`,
  );
  return {
    status: result.status,
    root,
    kept: report,
    log: result.stdout + result.stderr,
  };
}

test("the served kernel's log outlives the run it served, and its keys do not", (t) => {
  const run = teardown(t);
  const kept = path.join(path.dirname(run.kept), "kernel.log");
  assert.match(
    run.log,
    /cleanup_status=3/,
    "the trap still returns the status the run died with; keeping a log may not hide a failure",
  );
  assert.ok(existsSync(kept), `kernel.log is beside the report the job prints: ${run.log}`);
  assert.match(
    readFileSync(kept, "utf8"),
    /address already in use/,
    "and it holds what the kernel printed",
  );
  assert.match(run.log, /left=gone/, "the work directory is removed as it was before");
  const keptDir = path.join(run.root, "e2e", "out");
  assert.deepEqual(
    readFileSync(kept, "utf8").includes("factor_key"),
    false,
    "the log is a log, not the configuration",
  );
  assert.deepEqual(
    [...["config.yaml", "codes.json", "admin.jar"]].filter((name) =>
      existsSync(path.join(keptDir, name)),
    ),
    [],
    "the factor key, the webhook key and the recovery code stay in $work and die with it",
  );
});
