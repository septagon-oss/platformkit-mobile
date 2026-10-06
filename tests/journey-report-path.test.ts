import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// The job's last word on a journey is the JUnit file its report step prints, and
// that step refuses when the file is absent. That refusal only means "the
// journeys did not run" if the file it looks for is the one Maestro was told to
// write: the job names the path once, mobile_ci.sh passes it on, and run.sh hands
// it to Maestro as a JUnit report. A default that drifted in either script would
// have Maestro write one file and the job look for another.

const tracked = (at: string): string =>
  readFileSync(path.join(import.meta.dirname, "..", at), "utf8");

test("the report the job prints is the JUnit file the runner has Maestro write", () => {
  const job = tracked(".gitea/workflows/mobile-e2e.yml");
  const named = /^\s+PK_MOBILE_REPORT: (\S+)$/m.exec(job)?.[1];
  assert.ok(named, "the job names where the report goes");
  assert.match(job, /if \[ -s "\$PK_MOBILE_REPORT" \]; then\s+cat "\$PK_MOBILE_REPORT"/);

  const ci = tracked("scripts/e2e/mobile_ci.sh");
  assert.ok(
    ci.includes(`export PK_MOBILE_REPORT="\${PK_MOBILE_REPORT:-${named}}"`),
    "mobile_ci.sh passes the job's path on to run.sh",
  );

  const run = tracked("scripts/e2e/run.sh");
  assert.ok(run.includes(`report="\${PK_MOBILE_REPORT:-${named}}"`), "run.sh reads the same path");
  assert.match(run, /"\$MAESTRO" test e2e\/flows [^]*?--format junit --output "\$report"/);
});
