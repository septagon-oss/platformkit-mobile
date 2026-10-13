import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

// The run's kept copy of the diagnostics lives in a directory the script writes to,
// and writing to it must never be what makes a read happen: a full disk or a
// workspace another job left unwritable would otherwise end every read before it
// started and say "nothing readable in it from this device" about a device that was
// never asked. The copy is a copy. What the job log prints is decided by the device,
// and what the filesystem answers is said once, as a lost copy.

const checkout = path.join(import.meta.dirname, "..");

/**
 * answers is an adb with the lines a real device puts in its buffers: a fatal
 * exception, a process death and the JavaScript error that resolved no module.
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
 * drive runs the script as the job's step runs it, with the kept copy pointed at
 * `diagnostics` and Maestro's bundle at `debug`.
 */
function drive(
  t: TestContext,
  diagnostics: string,
  debug: string,
): { status: number | null; out: string; err: string } {
  const result = spawnSync("bash", ["-e", "-c", `${answers}scripts/e2e/device_logs.sh`], {
    cwd: checkout,
    encoding: "utf8",
    timeout: 20000,
    env: {
      ...process.env,
      ANDROID_SERIAL: "emulator-5584",
      PK_MOBILE_DIAGNOSTICS: diagnostics,
      PK_MOBILE_DEBUG_DIR: debug,
    },
  });
  assert.equal(
    result.error,
    undefined,
    `the script must answer inside its timeout: ${result.stderr}`,
  );
  return { status: result.status, out: result.stdout, err: result.stderr };
}

test("a copy that fails halfway through is the copy's story and not the device's", (t) => {
  // The directory answers the probe and then cannot take one section's file: a
  // crash.log that is a directory is how a full disk, or a name some earlier run
  // left taken, reads to a run in progress. The device's lines are what the run
  // needed, so they reach the job log whatever the copy does, and a failed tee is
  // never reported as a read that reached no answer.
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-device-halfcopy-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const out = path.join(root, "device");
  mkdirSync(out);
  mkdirSync(path.join(out, "crash.log"));
  const run = drive(t, out, path.join(root, "debug"));
  assert.equal(run.status, 0, `${run.out}${run.err}`);
  assert.match(run.out, /FATAL EXCEPTION: main/, "the section whose copy failed is still printed");
  assert.match(
    run.out,
    /Unable to resolve module solver/,
    "and the reads after it are still taken",
  );
  assert.ok(
    !/failed \(status|answered nothing in/.test(`${run.out}${run.err}`),
    `a copy that failed is not a device that failed: ${run.err}`,
  );
  assert.match(
    kept(path.join(out, "react-native.log")),
    /Unable to resolve module solver/,
    "and the sections whose copy could be written, were",
  );
});

function kept(file: string): string {
  assert.ok(existsSync(file), `${file} is where a kept section belongs`);
  return readFileSync(file, "utf8");
}

test("a directory that cannot be written costs the kept copy and not the device's lines", (t) => {
  // /dev/null/x and not a chmod'ed directory: the one path nobody can write into,
  // root included, so this case tests the refusal and not the uid it happened to
  // run under.
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-device-nowrite-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const debug = path.join(root, "debug");
  mkdirSync(debug);
  writeFileSync(path.join(debug, "commands-(sign-in).json"), "{}\n");

  const run = drive(t, "/dev/null/x", debug);
  assert.equal(run.status, 0, `an unwritable copy is not a failed step: ${run.err}`);
  assert.match(run.out, /FATAL EXCEPTION: main/, "the crash buffer still reaches the job log");
  assert.match(run.out, /am_anr/, "so does the process death");
  assert.match(
    run.out,
    /Unable to resolve module solver/,
    "and the JavaScript error before the first frame",
  );
  assert.match(
    run.out,
    /^\d+ .*commands-\(sign-in\)\.json$/m,
    "and the listing of what Maestro kept is still reached",
  );
  assert.match(
    run.err,
    /nothing can be written to/,
    `the lost copy is said by the thing that lost it: ${run.err}`,
  );
  assert.equal(
    run.err.split("nothing can be written to").length - 1,
    1,
    `one sentence about the lost copy, and not one per section: ${run.err}`,
  );
  assert.ok(
    !/tee:/.test(run.err),
    `the copy that cannot be kept is not attempted twelve times: ${run.err}`,
  );
  assert.ok(
    !/failed \(status/.test(`${run.out}${run.err}`),
    `no read is blamed on a device nobody reached: ${run.err}`,
  );
});

test("a directory that can be written keeps what the job log printed, one file per section", (t) => {
  // The other half of the same rule: the copy is the same text, so whoever reads
  // the artifact reads what a reader of the job log read. The probe that decides
  // whether a copy can be kept leaves no file of its own behind in it.
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-device-kept-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const out = path.join(root, "device");
  const run = drive(t, out, path.join(root, "debug"));
  assert.equal(run.status, 0, `${run.out}${run.err}`);
  const crash = kept(path.join(out, "crash.log"));
  assert.match(crash, /== crash: adb -s emulator-5584 shell logcat/, "the read it was, said");
  assert.match(crash, /FATAL EXCEPTION: main/, "and the lines the device answered");
  assert.ok(!/failed \(status/.test(crash), `a read that answered kept no failure line: ${crash}`);
  assert.match(kept(path.join(out, "device.log")), /sys\.boot_completed: 1/);
  assert.match(
    kept(path.join(out, "maestro.log")),
    /no Maestro debug directory at/,
    "absence is kept as plainly as presence",
  );
  assert.deepEqual(
    readdirSync(out).sort(),
    ["crash.log", "deaths.log", "device.log", "maestro.log", "react-native.log"],
    "one kept file per section, and no scratch left among them",
  );
});
