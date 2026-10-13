import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

// The device's own log says what happened before a screen existed; what happened
// at the assertion that failed is a screenshot and a view hierarchy, and the only
// honest capture of that moment is Maestro's, taken per step. The CLI keeps them
// under a directory it is told, so run.sh names that directory, cleans it of the
// previous run, and the job publishes it. Where it is named and where it is
// defaulted are two spellings of one value, and the artifact step reads the first.

const checkout = path.join(import.meta.dirname, "..");

/**
 * runFlows runs scripts/e2e/run.sh with adb and Maestro stubbed out, and returns
 * what Maestro was asked to do together with what its debug directory held at the
 * moment it was asked — which is where a bundle left over from an earlier journey
 * would show up beside this run's.
 */
function runFlows(
  t: TestContext,
  debug: string,
  stale: boolean,
): {
  status: number | null;
  args: string[];
  saw: string[] | null;
  log: string;
} {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-maestro-debug-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const apk = path.join(root, "fixture.apk");
  const maestro = path.join(root, "maestro");
  const record = path.join(root, "maestro.json");
  writeFileSync(apk, "fixture");
  if (stale) {
    mkdirSync(debug, { recursive: true });
    writeFileSync(path.join(debug, "an-earlier-run.png"), "stale");
  }
  // The stub is the CLI's stand-in: it records its argv, and the state of the
  // debug directory as it started, so a directory cleaned after Maestro ran would
  // not pass this case.
  writeFileSync(
    maestro,
    `#!/usr/bin/env node
const fs = require("node:fs");
let saw = null;
try {
  saw = fs.readdirSync(process.env.PK_MOBILE_DEBUG_DIR);
} catch {
  saw = null;
}
fs.writeFileSync(process.env.MAESTRO_RECORD, JSON.stringify({ argv: process.argv.slice(2), saw }));
`,
    { mode: 0o755 },
  );
  const result = spawnSync(
    "bash",
    [
      "-c",
      `adb() {
  if [ "$1" = devices ]; then printf 'List of devices attached\\nemulator-5554\\tdevice\\n'; fi
}
export -f adb
bash scripts/e2e/run.sh "$1"`,
      "debug-test",
      apk,
    ],
    {
      cwd: checkout,
      encoding: "utf8",
      timeout: 20000,
      env: {
        ...process.env,
        SERVER: "http://localhost:8098",
        EMAIL: "test@example.test",
        PASSWORD: "fixture-password",
        MODULE: "task",
        ENTITY: "task",
        KNOWN: "title",
        VERB: "resolve",
        VERB_FIELD: "resolution",
        VERB_TITLE: "Resolve a task",
        TOTP_EMAIL: "factor@example.test",
        TOTP_PASSWORD: "fixture-factor-password",
        FACTOR_CODE: "fixture-recovery-code",
        DUE_FIELD: "dueAt",
        STATUS_FIELD: "status",
        STATUS_VALUE: "open",
        ANDROID_SERIAL: "emulator-5554",
        TENANT_HOST: "",
        MAESTRO: maestro,
        PK_MOBILE_REPORT: path.join(root, "report.xml"),
        PK_MOBILE_DEBUG_DIR: debug,
        MAESTRO_RECORD: record,
      },
    },
  );
  const seen = existsSync(record) ? JSON.parse(readFileSync(record, "utf8")) : null;
  return {
    status: result.status,
    args: seen?.argv ?? [],
    saw: seen?.saw ?? null,
    log: result.stdout + result.stderr,
  };
}

test("Maestro is told where its debug bundle goes, and starts with that directory its own", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-maestro-debug-dir-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const debug = path.join(root, "out", "debug");
  const run = runFlows(t, debug, true);
  assert.equal(run.status, 0, run.log);
  const { args, saw } = run;
  const at = args.indexOf("--debug-output");
  assert.ok(at >= 0, `Maestro is asked for its debug bundle: ${JSON.stringify(args)}`);
  assert.equal(args[at + 1], debug, "and it goes where this job publishes it");
  assert.ok(
    args.includes("--flatten-debug-output"),
    "flattened, so the artifact names one path and Maestro's own cleanup stays out of this directory's",
  );
  assert.deepEqual(saw, [], `one run's bundle, not two runs': ${JSON.stringify(saw)}`);
});

test("the debug directory the job names is the one run.sh defaults to", () => {
  // The job names the directory once, in its env; run.sh defaults it for the
  // workstation. Two spellings of one path is how an artifact ends up publishing
  // a directory nothing wrote, so the strings are read from both files.
  const job = readFileSync(path.join(checkout, ".gitea/workflows/mobile-e2e.yml"), "utf8");
  const named = /^\s+PK_MOBILE_DEBUG_DIR: (\S+)$/m.exec(job)?.[1];
  assert.ok(named, "the job names where the debug bundle goes");
  const run = readFileSync(path.join(checkout, "scripts/e2e/run.sh"), "utf8");
  assert.ok(
    run.includes(`debug="\${PK_MOBILE_DEBUG_DIR:-${named}}"`),
    "run.sh defaults to the path the job names",
  );
  assert.match(run, /--debug-output "\$debug"/, "and hands that one path to Maestro");
});
