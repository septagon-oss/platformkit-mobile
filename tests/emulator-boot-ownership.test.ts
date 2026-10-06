import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("a failed emulator launch cannot adopt another job's booting device", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-emulator-ownership-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const workflow = readFileSync(".gitea/workflows/mobile-e2e.yml", "utf8");
  const step = workflow
    .split("      - name: Boot the emulator headless\n")[1]
    ?.split("\n      - name:")[0];
  assert.ok(step, "the workflow must contain its emulator boot step");
  const run = step.split("        run: |\n")[1];
  assert.ok(run, "the emulator boot step must have a shell body");
  const script = run.replace(/^          /gm, "");
  const output = path.join(root, "output");
  // An unrelated emulator is already booting (offline), then becomes ready
  // while this job's requested AVD fails to start. These exported functions
  // exercise the real workflow body without starting an adb server or device.
  const result = spawnSync(
    "bash",
    [
      "-e",
      "-o",
      "pipefail",
      "-c",
      `adb() {
  case "$1" in
    devices)
      printf 'List of devices attached\\n'
      if [ -e "$BOOT_ATTEMPTED" ]; then
        printf 'emulator-5560\\tdevice\\n'
      else
        printf 'emulator-5560\\toffline\\n'
      fi ;;
    wait-for-device)
      for i in $(seq 1 100); do
        [ ! -e "$BOOT_ATTEMPTED" ] || return 0
        sleep .01
      done
      return 1 ;;
    shell) printf '1\\n' ;;
  esac
}
emulator() {
  touch "$BOOT_ATTEMPTED"
  echo 'the requested AVD cannot start' >&2
  return 1
}
${script}`,
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        PK_MOBILE_AVD: "fixture-avd",
        BOOT_ATTEMPTED: path.join(root, "attempted"),
        GITHUB_OUTPUT: output,
      },
    },
  );
  assert.equal(result.error, undefined);
  const recorded = existsSync(output) ? readFileSync(output, "utf8") : "";
  assert.notEqual(
    result.status,
    0,
    `the job must refuse an unowned device after its own launch failed: ${recorded}`,
  );
  assert.doesNotMatch(recorded, /^serial=emulator-5560$/m);
});
