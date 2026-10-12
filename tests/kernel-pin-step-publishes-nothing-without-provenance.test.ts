// A missing provenance record must end the pin step before it publishes anything:
// an empty ref would let the next checkout choose the kernel's default branch.
// Each record is removed in turn, with the other still naming a valid commit.
import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parse } from "yaml";

test("the pin step publishes nothing when either provenance record is missing", (t) => {
  const checkout = path.join(import.meta.dirname, "..");
  const workflow = parse(
    readFileSync(path.join(checkout, ".gitea/workflows/mobile-e2e.yml"), "utf8"),
  ) as { jobs: { journey: { steps: { id?: string; run?: string }[] } } };
  const step = workflow.jobs.journey.steps.find((entry) => entry.id === "pin");
  assert.ok(step?.run, "the workflow declares the pin step");
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-missing-provenance-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "scripts/e2e"), { recursive: true });
  mkdirSync(path.join(root, "testdata"));
  for (const at of ["scripts/e2e/mobile_ci.sh", "scripts/e2e/tools.sh"]) {
    copyFileSync(path.join(checkout, at), path.join(root, at));
  }
  const records = ["testdata/catalog.source.json", "testdata/openapi.source.json"];
  const output = path.join(root, "output");
  for (const missing of records) {
    for (const at of records) {
      writeFileSync(
        path.join(root, at),
        JSON.stringify({ upstream: { commit: "0123456789abcdef0123456789abcdef01234567" } }),
      );
    }
    rmSync(path.join(root, missing));
    writeFileSync(output, "prior=value\n");
    const result: SpawnSyncReturns<string> = spawnSync(
      "/bin/bash",
      ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", step.run],
      {
        cwd: root,
        env: { PATH: "/usr/bin:/bin", HOME: root, GITHUB_OUTPUT: output },
        encoding: "utf8",
        timeout: 10_000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 1, `${missing}: ${result.stderr}`);
    assert.ok(result.stderr.includes(missing), result.stderr);
    assert.equal(readFileSync(output, "utf8"), "prior=value\n", missing);
    assert.equal(result.stdout, "", missing);
  }
});
