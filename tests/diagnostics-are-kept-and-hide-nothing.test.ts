import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// What a diagnostics step is worth is decided by where it sits: after the journey
// that failed, before the emulator is killed, and never in a position from which it
// could overwrite that journey's verdict. None of that is visible in what a script
// prints, so the job's own file is the fixture here — the step order, the device it
// names, the directories it names once and the pin its artifact uses are read out of
// the YAML the runner executes. `continue-on-error` is refused of this file by
// tests/flow-coverage.test.ts, which owns that rule.

const tracked = (at: string): string =>
  readFileSync(path.join(import.meta.dirname, "..", at), "utf8");

const NAMES = [
  "Run every journey in e2e/flows",
  "What the device saw",
  "Keep what the device saw",
  "The report, in the job's own log",
  "Remove this job's emulator and NATS container",
];

test("the device is asked while it is alive, and the job's verdict stays the journey's", () => {
  const job = tracked(".gitea/workflows/mobile-e2e.yml");
  const at = NAMES.map((name) => {
    const index = job.indexOf(`- name: ${name}`);
    assert.ok(index >= 0, `the job has a step named ${name}`);
    return index;
  });
  assert.deepEqual(
    at,
    [...at].sort((a, b) => a - b),
    "journey, diagnostics, artifact, report, teardown — in that order",
  );
  const diagnostics = job.slice(at[1], at[2]);
  assert.match(diagnostics, /if: failure\(\)/, "a green journey has nothing to explain");
  assert.match(
    diagnostics,
    /ANDROID_SERIAL: \$\{\{ steps\.emulator\.outputs\.serial \}\}/,
    "it reads the emulator this job booted, not whichever device adb offers",
  );
  assert.match(diagnostics, /run: scripts\/e2e\/device_logs\.sh/, "one script, called by the step");
  const artifact = job.slice(at[2], at[3]);
  assert.match(artifact, /if: always\(\)/, "a run that failed is the run worth keeping");
  assert.match(
    artifact,
    /e2e\/out\//,
    "the report, the bundle and the device logs are one directory",
  );
  assert.match(artifact, /emulator\.log/, "and the boot step's log is kept beside them");
  assert.match(artifact, /retention-days: \d+/, "with a stated life, not the store's default");
  assert.match(
    artifact,
    /if-no-files-found: warn/,
    "a run that wrote nothing is already refused by the report step below",
  );
});

test("the device's own reads are one script, and the directories it writes are the ones the job publishes", () => {
  const job = tracked(".gitea/workflows/mobile-e2e.yml");
  const logs = tracked("scripts/e2e/device_logs.sh");
  const artifact = job.slice(
    job.indexOf("- name: Keep what the device saw"),
    job.indexOf("- name: The report, in the job's own log"),
  );
  const listed = /path: \|\n((?:[ ]+\S+\n)+)/.exec(artifact)?.[1];
  assert.ok(listed, "the artifact step lists what it keeps");
  const published = listed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  // A directory the job names but the artifact does not publish is evidence that
  // exists for the length of the job log and nothing longer. The listing spells a
  // directory with a trailing slash and a path beneath it without one, so the
  // comparison drops the slash from both sides.
  const publishedUnder = (dir: string): boolean => {
    const below = dir.replace(/\/+$/, "");
    return published.some((at) => {
      const above = at.replace(/\/+$/, "");
      return below === above || below.startsWith(`${above}/`);
    });
  };
  for (const [variable, where, source] of [
    ["PK_MOBILE_DIAGNOSTICS", "scripts/e2e/device_logs.sh", logs],
    ["PK_MOBILE_DEBUG_DIR", "scripts/e2e/run.sh", tracked("scripts/e2e/run.sh")],
  ] as const) {
    const named = new RegExp(`^\\s+${variable}: (\\S+)$`, "m").exec(job)?.[1];
    assert.ok(named, `the job names ${variable} once, in its env`);
    // The same reading journey-report-path.test.ts holds for the report: the job
    // names the path once and the script that runs without a job defaults to that
    // string, so an artifact can never publish a directory nothing wrote to.
    assert.ok(
      source.includes(`:-${named}}"`),
      `${variable}: ${where} must default to the path the job names, not another one`,
    );
    assert.ok(publishedUnder(named), `${named} is written somewhere the artifact publishes`);
  }
  const report = /^\s+PK_MOBILE_REPORT: (\S+)$/m.exec(job)?.[1];
  assert.ok(report, "the job names where the report goes");
  assert.ok(
    publishedUnder(path.dirname(report)),
    "so does the directory the served kernel's log is copied to",
  );
  // The kernel's log is written where the artifact step can reach it, which is
  // not the work directory the harness removes.
  assert.match(
    tracked("scripts/e2e/mobile_ci.sh"),
    /cp "\$work\/app\.log" "\$\(dirname "\$PK_MOBILE_REPORT"\)\/kernel\.log"/,
    "the served kernel's log moves to the published directory before the trap removes its own",
  );
});

test("the artifact step uses the pin this repository already runs", () => {
  const job = tracked(".gitea/workflows/mobile-e2e.yml");
  const other = tracked(".gitea/workflows/android.yml");
  const pinned = /uses: actions\/upload-artifact@(\S+) # (\S+)/.exec(other);
  assert.ok(pinned, "the APK job pins the artifact action");
  const used = [...job.matchAll(/uses: actions\/upload-artifact@(\S+) # (\S+)/g)];
  assert.equal(used.length, 1, "the journey uploads its evidence once");
  assert.equal(used[0]![1], pinned![1], "at the object this repository already runs");
  assert.equal(used[0]![2], pinned![2], "and calls it by the same version");
});
