import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

// Every line the device diagnostics print is a claim about one device, so the
// script may read no other: each call below the listing names the serial the job
// booted (an unqualified adb call is answered by whichever device the host holds,
// which in a journey queue is another run's crash buffer), and every logcat is
// bounded by the `-t` the device itself honours, because "bounded" has to be a
// property of the command sent and not a hope about what comes back.

const script = "scripts/e2e/device_logs.sh";

/**
 * drive runs the script against an adb that records every call it is given.
 *
 * `serial` is what ANDROID_SERIAL names (unset where the case is about a host
 * nothing named), `attached` is the device list the stub answers with, and
 * `buffers` decides whether the three reads reach an answer or a transport error.
 */
function drive(
  t: TestContext,
  stub: { serial?: string; attached: string; buffers?: boolean },
): { status: number | null; calls: string[]; out: string; err: string } {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-device-argv-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const recorded = path.join(root, "adb.txt");
  const answer =
    stub.buffers === false ? "return 3" : "printf 'E/AndroidRuntime: FATAL EXCEPTION\\n'";
  const result = spawnSync(
    "bash",
    [
      "-c",
      `adb() {
  printf '%s\\n' "$*" >> "$ADB_ARGUMENTS"
  case "$1" in
    devices) printf 'List of devices attached\\n%b' "${stub.attached}" ;;
    *) case "$*" in
         *getprop*) printf '1\\n' ;;
         *logcat*) ${answer} ;;
       esac ;;
  esac
}
export -f adb
bash "$1"`,
      "argv-test",
      script,
    ],
    {
      cwd: path.join(import.meta.dirname, ".."),
      encoding: "utf8",
      timeout: 20000,
      env: {
        ...process.env,
        ANDROID_SERIAL: stub.serial ?? "",
        PK_MOBILE_DIAGNOSTICS: path.join(root, "device"),
        PK_MOBILE_DEBUG_DIR: path.join(root, "debug"),
        ADB_ARGUMENTS: recorded,
      },
    },
  );
  assert.equal(
    result.error,
    undefined,
    `the script must answer inside its timeout: ${result.stderr}`,
  );
  return {
    status: result.status,
    calls: existsSync(recorded) ? readFileSync(recorded, "utf8").trimEnd().split("\n") : [],
    out: result.stdout,
    err: result.stderr,
  };
}

test("every read names the device the job booted and bounds the buffer on the device", (t) => {
  const run = drive(t, { serial: "emulator-5584", attached: "emulator-5584\\tdevice\\n" });
  assert.equal(run.status, 0, `${run.out}${run.err}`);
  assert.ok(
    run.calls.length >= 4,
    `the listing, the boot state and three buffers are read: ${run.calls}`,
  );
  for (const call of run.calls) {
    // The listing is the one call taken unqualified on purpose: `-s` does not
    // narrow `adb devices`, and the question it asks is how many devices the host
    // holds. scripts/e2e/run.sh and the job's own boot step take it the same way.
    if (call === "devices") continue;
    assert.match(call, /^-s emulator-5584 /, `a device read named to nothing: ${call}`);
    if (!call.includes("logcat")) continue;
    const bound = /(?:^|\s)-t (\d+)(?:\s|$)/.exec(call);
    assert.ok(bound, `an unbounded logcat would dump a booted emulator: ${call}`);
    assert.ok(
      Number(bound[1]) > 0 && Number(bound[1]) <= 4000,
      `the bound on this read is not the one this script states: ${call}`,
    );
    assert.match(call, /(?:^|\s)-d(?:\s|$)/, `a logcat without -d follows forever: ${call}`);
  }
});

test("two devices and no serial named is refused rather than guessed at", (t) => {
  // Nothing below this line can be trusted about a device the caller did not
  // name, and adb picks one of the two itself. The refusal is the fix: the job
  // names its emulator, and a workstation has one device to begin with.
  const run = drive(t, {
    attached: "emulator-5584\\tdevice\\nemulator-5586\\tdevice\\n",
  });
  assert.equal(run.status, 0, `a refusal to read is not a failure: ${run.err}`);
  assert.match(
    run.err,
    /2 devices are attached and none is named/,
    `the refusal says what to set: ${run.err}`,
  );
  assert.deepEqual(
    run.calls.filter((call) => call.includes("logcat")),
    [],
    `no buffer is read off a device nobody named: ${JSON.stringify(run.calls)}`,
  );
});

test("a buffer that will not read is named and the run keeps going to the next one", (t) => {
  const run = drive(t, {
    serial: "emulator-5584",
    attached: "emulator-5584\\tdevice\\n",
    buffers: false,
  });
  assert.equal(run.status, 0, `${run.out}${run.err}`);
  assert.match(run.err, /-b crash .*failed \(status 3\)/, "the crash buffer says it failed");
  assert.match(run.out, /no Maestro debug directory at/, "and the listing after it still happens");
});
