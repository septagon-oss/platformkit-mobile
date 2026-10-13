import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parse } from "yaml";

// The step that names the kernel to build is the job's refusal when the two
// provenance records cannot name one: a record missing, a commit that is not a full
// object id, or two records naming different builds. What the harness prints is
// only a refusal if the step that runs it ends there: a step that goes green with
// an empty commit hands the checkout no ref, and a checkout with no ref takes the
// repository's default branch — the one thing the journey must never build.

const checkout = path.join(import.meta.dirname, "..");
const records = ["testdata/catalog.source.json", "testdata/openapi.source.json"];

/** pinStep is the shell body of the workflow step whose id is `pin`, as the runner runs it. */
function pinStep(): string {
  const document = parse(
    readFileSync(path.join(checkout, ".gitea/workflows/mobile-e2e.yml"), "utf8"),
  ) as {
    jobs: { journey: { steps: { id?: string; run?: string }[] } };
  };
  const step = document.jobs.journey.steps.find((entry) => entry.id === "pin");
  assert.ok(step?.run, "the job has a step with id pin that runs a shell body");
  return step.run;
}

/** plantedRoot copies the harness into a root of its own, with the records the case writes. */
function plantedRoot(t: { after: (fn: () => void) => void }, commits: [string, string]): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-pin-step-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "scripts/e2e"), { recursive: true });
  mkdirSync(path.join(root, "testdata"), { recursive: true });
  // The step runs the harness by path, so the copy keeps the executable bit the tracked file has.
  for (const at of ["scripts/e2e/mobile_ci.sh", "scripts/e2e/tools.sh"]) {
    writeFileSync(path.join(root, at), readFileSync(path.join(checkout, at)), { mode: 0o755 });
  }
  records.forEach((at, index) => {
    writeFileSync(
      path.join(root, at),
      `${JSON.stringify({ upstream: { commit: commits[index] } })}\n`,
    );
  });
  return root;
}

/** runStep runs the step body the way the runner's default shell does: bash with -e and pipefail. */
function runStep(root: string): { status: number; err: string; output: string } {
  const output = path.join(root, "github-output");
  writeFileSync(output, "");
  const got = spawnSync(
    "/bin/bash",
    ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", pinStep()],
    {
      cwd: root,
      env: { PATH: "/usr/bin:/bin", HOME: root, GITHUB_OUTPUT: output },
      encoding: "utf8",
    },
  );
  return { status: got.status ?? -1, err: got.stderr, output: readFileSync(output, "utf8") };
}

const older = "7fc4b0abd547f4e30ad4e5b8b87ef6cc34138bb0";
const newer = "cbaa47b4825a90d95d61b55f39ffdf7051adf1ba";

test("the pin step names the commit when the records agree", (t) => {
  const agreed = runStep(plantedRoot(t, [newer, newer]));
  assert.equal(agreed.status, 0, agreed.err);
  assert.equal(agreed.output, `commit=${newer}\n`);
});

test("the pin step ends the job when the records name different builds", (t) => {
  const split = runStep(plantedRoot(t, [older, newer]));
  for (const at of records) {
    assert.ok(split.err.includes(at), `the refusal names ${at}: ${split.err}`);
  }
  assert.notEqual(
    split.status,
    0,
    "a refusal the step swallows is a checkout of the default branch",
  );
  assert.doesNotMatch(
    split.output,
    /^commit=$/m,
    `an empty commit is a ref the checkout fills with a branch: ${JSON.stringify(split.output)}`,
  );
});

test("the pin step ends the job when a record is not a full object id", (t) => {
  const truncated = runStep(plantedRoot(t, [newer.slice(0, 12), newer]));
  assert.match(truncated.err, /testdata\/catalog\.source\.json names no kernel to serve/);
  assert.notEqual(truncated.status, 0);
  assert.doesNotMatch(truncated.output, /^commit=$/m);
});
