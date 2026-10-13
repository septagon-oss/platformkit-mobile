import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// A directory that keeps no copy must not make a dead device look healthy: when
// nothing can be written and the device answers every read with a failure, the
// job log still names each read that reached no answer, with adb's own status,
// beside the one sentence that says no copy is kept. The lost copy and the dead
// transport are two facts, and neither may stand in for the other.

const checkout = path.join(import.meta.dirname, "..");

/** dead is an adb whose listing answers and whose every buffer read fails. */
const dead = `adb() {
  case "$*" in
    devices) printf 'List of devices attached\\nemulator-5584\\tdevice\\n' ;;
    *getprop*) printf '1\\r\\n' ;;
    *) echo "error: closed" >&2; return 3 ;;
  esac
}
export -f adb
`;

test("a dead device is named per read even when the copy cannot be kept", (t) => {
  const scratch = mkdtempSync(path.join(os.tmpdir(), "device-logs-dead-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const result = spawnSync("bash", ["-e", "-c", `${dead}scripts/e2e/device_logs.sh`], {
    cwd: checkout,
    encoding: "utf8",
    timeout: 20000,
    env: {
      ...process.env,
      ANDROID_SERIAL: "emulator-5584",
      PK_MOBILE_DIAGNOSTICS: "/dev/null/x",
      PK_MOBILE_DEBUG_DIR: path.join(scratch, "debug"),
    },
  });
  assert.equal(result.error, undefined, `the script must answer inside its timeout`);
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /nothing can be written to \/dev\/null\/x/);
  for (const buffer of ["-b crash", "-b events", "-b main"]) {
    const failure = new RegExp(`${buffer} .*failed \\(status 3\\)`);
    assert.match(result.stderr, failure, `the ${buffer} read is named as failed`);
  }
});
