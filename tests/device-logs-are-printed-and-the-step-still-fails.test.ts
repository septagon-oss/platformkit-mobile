import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

// A journey that fails on a device has to say why. The job's diagnostics step is
// the one place that asks the device for its own log, and two properties of it are
// decided without a device: that what the device answers reaches the job log and
// the run's kept copy, and that whatever the device does, the step ends green — a
// diagnostics step that failed would report its own failure instead of the
// journey's, which is the same harm `continue-on-error` does from the other side.
// The step body is run as the runner runs it (`bash -e`), and adb is a shell
// function, so no adb server, emulator or device is involved.

const checkout = path.join(import.meta.dirname, "..");

/**
 * stepBody is the diagnostics step's own `run:` line, as the job spells it.
 */
function stepBody(): string {
  const step = readFileSync(path.join(checkout, ".gitea/workflows/mobile-e2e.yml"), "utf8")
    .split("- name: What the device saw\n")[1]
    ?.split("\n      - name:")[0];
  assert.ok(step, "the job has a diagnostics step");
  assert.match(step, /if: failure\(\)/, "it runs when the journey failed and not otherwise");
  assert.match(
    step,
    /ANDROID_SERIAL: \$\{\{ steps\.emulator\.outputs\.serial \}\}/,
    "it is told which device to ask, the same way the journey step is",
  );
  const body = /^ {8}run: (.+)$/m.exec(step)?.[1];
  assert.ok(body, "the diagnostics step has a run line");
  return body;
}

/**
 * answers is an adb that replies to each buffer with a line a real device would
 * have put there: a fatal exception in the crash buffer, a death in events, a
 * JavaScript error that resolved no module in the app's own buffer.
 */
const answers = `adb() {
  case "$1" in
    devices) printf 'List of devices attached\\nemulator-5584\\tdevice\\n' ;;
    -s)
      case "$*" in
        *getprop*) printf '1\\r\\n' ;;
        *"-b crash"*) printf 'E/AndroidRuntime(  142): FATAL EXCEPTION: main\\r\\n' ;;
        *"-b events"*) printf 'I/am_anr  (  142): dev.septagon.platformkit.ci\\r\\n' ;;
        *"-b main"*) printf 'I/ReactNativeJS(  142): Unable to resolve module solver\\r\\n' ;;
      esac ;;
  esac
}
export -f adb
`;

/**
 * silent is a device that answers nothing: the transport is dead, every read
 * fails, and the run this step describes already failed without this step's help.
 */
const silent = `adb() {
  case "$1" in
    devices) printf 'List of devices attached\\nemulator-5584\\tdevice\\n' ;;
    *) return 2 ;;
  esac
}
export -f adb
`;

function runDeviceStep(
  t: TestContext,
  stub: string,
): {
  status: number | null;
  out: string;
  err: string;
  kept: string;
} {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-device-logs-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const kept = path.join(root, "device");
  const result = spawnSync("bash", ["-e", "-c", `${stub}${stepBody()}`], {
    cwd: checkout,
    encoding: "utf8",
    timeout: 20000,
    env: {
      ...process.env,
      ANDROID_SERIAL: "emulator-5584",
      PK_MOBILE_DIAGNOSTICS: kept,
      // A directory of this case's own, so the listing below speaks of this run
      // and never of whatever an earlier journey left in e2e/out.
      PK_MOBILE_DEBUG_DIR: path.join(root, "debug"),
    },
  });
  assert.equal(
    result.error,
    undefined,
    `the step must answer inside its timeout: ${result.stderr}`,
  );
  return {
    status: result.status,
    out: result.stdout,
    err: result.stderr,
    kept: existsSync(kept) ? readFileSync(path.join(kept, "crash.log"), "utf8") : "",
  };
}

test("a failed journey prints the crash, the death and the app's own error, and the step still ends green", (t) => {
  const run = runDeviceStep(t, answers);
  assert.equal(run.status, 0, `${run.out}${run.err}`);
  assert.match(run.out, /emulator-5584\s+device/, "the device this run drove is named");
  assert.match(run.out, /sys\.boot_completed: 1/, "and whether it was booted is said");
  assert.match(run.out, /FATAL EXCEPTION: main/, "the crash buffer reaches the job log");
  assert.match(run.out, /am_anr/, "so does the process death, from the events buffer");
  assert.match(
    run.out,
    /Unable to resolve module solver/,
    "and the JavaScript error before render, from the app's own tags",
  );
  assert.match(
    run.out,
    /-b crash -t 2000 -d/,
    "every read names the bound it asked the device for",
  );
  assert.match(run.kept, /FATAL EXCEPTION: main/, "and what the job keeps holds the same lines");
});

test("a device that answers nothing is said, and the step ends green anyway", (t) => {
  // R4: this unit never carries the verdict. Every buffer unreadable is a line
  // per buffer naming the command that failed, the listing of what Maestro kept
  // is still reached, and the status the job sees is this script's zero.
  const run = runDeviceStep(t, silent);
  assert.equal(run.status, 0, `an unreadable device must not fail the step: ${run.err}`);
  assert.match(run.err, /logcat .*-b crash .*failed \(status 2\)/, "the crash buffer is named");
  assert.match(run.err, /-b events/, "and the events buffer beside it");
  assert.match(run.err, /-b main/, "and the app's own buffer");
  assert.match(
    run.out,
    /no Maestro debug directory at/,
    "what Maestro kept is still listed, absence included",
  );
});
