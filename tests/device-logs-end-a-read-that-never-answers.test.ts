import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

// `-t` bounds how far back a device reads and `-d` makes the read finish once it
// answers; neither is a bound on waiting for a device that never answers. An adb
// call against a wedged adbd simply does not return, and a diagnostics step that
// waits for one waits until the job's own ceiling — past the artifact step that
// keeps the evidence and past the teardown that frees the device for the next run.
// So every read this script sends carries a deadline of its own, and a read that
// meets it is named as one.

const checkout = path.join(import.meta.dirname, "..");
const script = "scripts/e2e/device_logs.sh";

/**
 * drive runs the script the way the job's step runs it, with adb a shell function
 * and deadline as the seconds one read may take. A wedged stub answers the listing
 * (that is the adb server's own reply) and never a device-facing call; an answering
 * one replies to each buffer with the line a real device would have put there.
 *
 * The wedge is a loop of short sleeps rather than one long one: a killed caller's
 * child holds the job's stdout open until it finishes, which is the harm a wedge
 * has to avoid, and a real adb client dies with the term it is sent.
 */
function drive(
  t: TestContext,
  stub: { buffers: "wedged" | "answers"; deadline: string },
): { status: number | null; out: string; err: string; seconds: number } {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-device-deadline-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const deviceAnswers =
    stub.buffers === "answers"
      ? `      case "$*" in
        *getprop*) printf '1\\r\\n' ;;
        *"-b crash"*) printf 'E/AndroidRuntime(  142): FATAL EXCEPTION: main\\r\\n' ;;
        *"-b events"*) printf 'I/am_anr  (  142): dev.septagon.platformkit.ci\\r\\n' ;;
        *"-b main"*) printf 'I/ReactNativeJS(  142): Unable to resolve module solver\\r\\n' ;;
      esac`
      : `      while :; do sleep 0.25 & wait; done`;
  const started = Date.now();
  const result = spawnSync(
    "bash",
    [
      "-e",
      "-c",
      `adb() {
  case "$1" in
    devices) printf 'List of devices attached\\nemulator-5584\\tdevice\\n' ;;
    -s)
${deviceAnswers} ;;
  esac
}
export -f adb
bash ${script}`,
    ],
    {
      cwd: checkout,
      encoding: "utf8",
      // Generously above four one-second reads, and the bound a missed deadline
      // lands on rather than a run that hangs the suite.
      timeout: 20000,
      env: {
        ...process.env,
        ANDROID_SERIAL: "emulator-5584",
        PK_MOBILE_DIAGNOSTICS: path.join(root, "device"),
        PK_MOBILE_DEBUG_DIR: path.join(root, "debug"),
        PK_MOBILE_READ_TIMEOUT: stub.deadline,
      },
    },
  );
  assert.equal(
    result.error,
    undefined,
    `a wedged device must not hold this run past its deadline: ${result.stderr}`,
  );
  return {
    status: result.status,
    out: result.stdout,
    err: result.stderr,
    seconds: (Date.now() - started) / 1000,
  };
}

test("a device that never answers is ended read by read, and the listing is still reached", (t) => {
  const run = drive(t, { buffers: "wedged", deadline: "1" });
  assert.equal(run.status, 0, `a device that hangs is not this step's failure: ${run.err}`);
  // The boot state and the three buffers: every read that goes to the device. The
  // listing above them is the adb server's own reply and a wedged adbd holds none
  // of it up, which is why the run can still say the device is attached.
  assert.equal(
    run.err.split("and was ended").length - 1,
    4,
    `each device read names its own deadline: ${run.err}`,
  );
  assert.match(
    run.err,
    /emulator-5584 answered nothing to sys\.boot_completed in 1s/,
    "the boot state is one of them",
  );
  assert.match(
    run.err,
    /-b crash .*answered nothing in 1s/,
    "and the crash buffer says it reached no answer",
  );
  assert.match(
    run.out,
    /sys\.boot_completed: nothing/,
    "what it did not answer is said as nothing",
  );
  assert.ok(
    !/answered nothing in/.test(run.out),
    `a read's failure is said on stderr, where its own lines are not: ${run.out}`,
  );
  assert.match(
    run.out,
    /no Maestro debug directory at/,
    "and what Maestro kept is still listed, so the artifact step and the teardown get their turn",
  );
  assert.ok(
    run.seconds < 15,
    `four one-second reads finish in seconds, not whenever the device comes back: ${run.seconds}s`,
  );
});

test("a read that answers inside its deadline is printed and never ended", (t) => {
  const run = drive(t, { buffers: "answers", deadline: "10" });
  assert.equal(run.status, 0, `${run.out}${run.err}`);
  assert.match(run.out, /FATAL EXCEPTION: main/, "the crash buffer reaches the job log");
  assert.match(run.out, /sys\.boot_completed: 1/, "and so does the boot state read the same way");
  assert.ok(
    !/and was ended/.test(`${run.out}${run.err}`),
    `a device that answered was not ended: ${run.err}`,
  );
  assert.ok(run.seconds < 10, `a device that answers is not waited for: ${run.seconds}s`);
});

test("the deadline a run defaults to leaves the artifact and the teardown their turn", () => {
  // The ceiling is the job's own and the device reads are four; the default is what
  // a run that names nothing gets, so it is a number stated in the script and one a
  // whole journey's worth of wedged reads still fits inside.
  const seconds = Number(
    /PK_MOBILE_READ_TIMEOUT:-(\d+)/.exec(readFileSync(path.join(checkout, script), "utf8"))?.[1],
  );
  assert.ok(Number.isInteger(seconds) && seconds > 0, "the script defaults one read's deadline");
  assert.match(
    readFileSync(path.join(checkout, ".gitea/workflows/mobile-e2e.yml"), "utf8"),
    /timeout-minutes: \d+/,
    "the job states the ceiling they have to fit inside",
  );
  assert.ok(
    4 * seconds <= 600,
    `four reads at ${seconds}s each leave the job's ceiling for the artifact and the teardown`,
  );
});
