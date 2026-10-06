import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("the report step refuses absent or empty evidence and prints a completed report", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-journey-report-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const job = readFileSync(".gitea/workflows/mobile-e2e.yml", "utf8");
  const step = job
    .split("- name: The report, in the job's own log\n")[1]
    ?.split("\n      - name:")[0];
  assert.ok(step, "the job has a report step");
  assert.match(step, /if: always\(\)/);
  const script = step.split("run: |\n")[1]?.replace(/^          /gm, "");
  assert.ok(script, "the report step has a shell body");
  const report = path.join(root, "journeys.xml");
  const run = () =>
    spawnSync("bash", ["-e", "-c", script], {
      encoding: "utf8",
      timeout: 5000,
      env: { ...process.env, PK_MOBILE_REPORT: report },
    });
  for (const state of ["absent", "empty"]) {
    if (state === "empty") writeFileSync(report, "");
    const result = run();
    assert.equal(result.status, 1, `${state}: ${result.stdout}${result.stderr}`);
    assert.ok(result.stderr.includes(report), "the refusal names the missing evidence");
  }
  const evidence = '<testsuites tests="1" failures="0"/>\n';
  writeFileSync(report, evidence);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, evidence);
});
