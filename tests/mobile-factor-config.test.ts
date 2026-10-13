import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("the device harness supplies a factor key before bootstrapping its server", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-factor-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const kernelStub = path.join(root, "platformkit");
  writeFileSync(
    kernelStub,
    `#!/usr/bin/env bash
cp "$(dirname "$0")/config.yaml" "$CONFIG_CAPTURE"
exit 73
`,
    { mode: 0o755 },
  );
  // As in maestro-device-selection, exported functions replace external tools,
  // and the kernel the harness is handed is a file this case wrote: the same copy
  // into the run directory, the same bootstrap, the same config beside it. Stop at
  // bootstrap after copying the actual config: no database, daemon, network,
  // emulator, or application server is started by this case.
  const result = spawnSync(
    "bash",
    [
      "-c",
      `unset factor_key
psql() { :; }
export -f psql
bash scripts/e2e/mobile_ci.sh fixture.apk`,
    ],
    {
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        TMPDIR: root,
        CONFIG_CAPTURE: path.join(root, "config.yaml"),
        PLATFORMKIT_TEST_ADMIN_URL: "postgres://localhost/admin",
        PLATFORMKIT_TEST_DATABASE_URL: "postgres://localhost/app",
        PK_KERNEL_BIN: kernelStub,
        MODULE: "task",
        ENTITY: "task",
        KNOWN: "title",
        VERB: "resolve",
        VERB_FIELD: "resolution",
        VERB_TITLE: "Resolve a task",
        DUE_FIELD: "dueAt",
        STATUS_FIELD: "status",
        STATUS_VALUE: "open",
      },
    },
  );
  assert.equal(result.status, 73, result.stdout + result.stderr);
  const config = readFileSync(path.join(root, "config.yaml"), "utf8");
  assert.match(config, /factor_key: "[a-f0-9]{64}"/);
  // The kernel refuses to start without the key that wraps a webhook endpoint's signing secret.
  assert.match(config, /webhook:\n  secret_key: "[a-f0-9]{32}"/);
});
