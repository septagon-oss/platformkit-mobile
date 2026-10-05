import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

// The device this job runs its journeys on has to be the emulator this job
// started. `tests/emulator-boot-ownership.test.ts` proves the host is refused
// while a foreign device is already attached; these cases prove the two halves
// of the claim that start after the launch: that a launch which died ends the
// step rather than leaving a question for adb to answer from somewhere else, and
// that the serial published is this step's own console port with nothing else on
// the host. The step is run as the job runs it — the YAML body, dedented — with
// adb and emulator as shell functions, so no adb server, emulator or device is
// ever started, and a stub that answers a shell command only for the serial
// named to it is what proves no adb call below the launch is unqualified.

/** bootStep is the workflow's own emulator boot body, dedented: the shell the job runs. */
function bootStep(): string {
  const step = readFileSync(".gitea/workflows/mobile-e2e.yml", "utf8")
    .split("      - name: Boot the emulator headless\n")[1]
    ?.split("\n      - name:")[0];
  assert.ok(step, "the workflow must contain its emulator boot step");
  const run = step.split("        run: |\n")[1];
  assert.ok(run, "the emulator boot step must have a shell body");
  return run.replace(/^ {10}/gm, "");
}

/**
 * boot runs that body against a stubbed host.
 *
 * `attached` is what `adb devices` answers before this job launches anything;
 * `appears` is what it answers after, which is where a device another job was
 * already booting turns up. `boots` is the only serial the stub will answer
 * `shell getprop sys.boot_completed` for, and names it only when the call passes
 * it as `-s <serial>`: an unqualified adb call is answered by nothing. `fails`
 * is whether this job's own launch survives.
 *
 * The stub's own device comes into existence at the launch, the way a real one
 * does: adb answers a question about a serial only once a process on the host
 * claimed that console port, which is the `registered` file the `emulator` stub
 * writes before it does anything else, and the launch then outlives the step's
 * poll period. Both the listing and the boot answer read that one file, so
 * neither can report a device the other does not. A stub that answered
 * `boot_completed` from the first poll, before the launch had reached its marker
 * write, let the step go ready while `adb devices` still listed nothing, so the
 * step refused its own device: a case that failed on a loaded host and passed on
 * a quiet one, which is the shape of a test that proves nothing.
 */
function boot(
  t: TestContext,
  stub: {
    attached?: string;
    appears?: string;
    boots?: string;
    fails?: boolean;
  },
): {
  status: number | null;
  recorded: string;
  log: string;
  launched: boolean;
  registered: string;
} {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-emulator-launch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = path.join(root, "output");
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
      printf '%b' "${stub.attached ?? ""}"
      [ -s "$BOOT_REGISTERED" ] || return 0
      printf '%b' "${stub.appears ?? ""}" ;;
    -s)
      # Nothing answers for a device this host does not have: adb names a serial
      # once the emulator process claimed that console port, so the launch above
      # is what puts a device on this stub's host, and the boot answer and the
      # listing below the launch are read from the one claim.
      [ "$(cat "$BOOT_REGISTERED" 2>/dev/null)" = "$2" ] &&
        [ "$2" = "${stub.boots ?? ""}" ] && [ "$3" = shell ] &&
        [ "$4" = getprop ] && [ "$5" = sys.boot_completed ] && printf '1\\r\\n' ;;
  esac
}
emulator() {
  port=""
  while [ "$#" -gt 0 ]; do
    if [ "$1" = -port ]; then port="$2"; shift 2; else shift; fi
  done
  if [ -z "$port" ]; then
    echo 'no console port claimed: the emulator would take one adb cannot name' >&2
    return 1
  fi
  printf 'emulator-%s\\n' "$port" > "$BOOT_REGISTERED"
  if [ "${stub.fails ? 1 : 0}" = 1 ]; then
    echo 'the requested AVD cannot start' >&2
    return 1
  fi
  # The launch outlives the wait that follows it, as a real emulator does: this
  # sleep is longer than the step's own two-second poll so the only way the step
  # can stop watching its process is the boot answer, never a lifetime chosen here.
  sleep 5
}
${bootStep()}`,
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 20000,
      env: {
        ...process.env,
        PK_MOBILE_AVD: "fixture-avd",
        BOOT_REGISTERED: path.join(root, "registered"),
        GITHUB_OUTPUT: output,
      },
    },
  );
  assert.equal(
    result.error,
    undefined,
    `the step must answer inside its timeout: ${result.stderr}`,
  );
  const registered = existsSync(path.join(root, "registered"))
    ? readFileSync(path.join(root, "registered"), "utf8").trim()
    : "";
  return {
    status: result.status,
    launched: registered !== "",
    registered,
    recorded: existsSync(output) ? readFileSync(output, "utf8") : "",
    log:
      result.stderr +
      (existsSync(path.join(root, "emulator.log"))
        ? readFileSync(path.join(root, "emulator.log"), "utf8")
        : ""),
  };
}

test("a host that already has a device in any state is refused before anything is launched", (t) => {
  // `offline` is adb's own word for a device it can name but not talk to —
  // another job's emulator mid-boot. A check that kept only `device` would let
  // this host through to the launch below, where a question asked of adb could
  // be answered by that half-booted device. The refusal has to come first: the
  // job that launches into this host has already added a process to it.
  const run = boot(t, { attached: "emulator-5560\\toffline\\n" });
  assert.notEqual(
    run.status,
    0,
    `an occupied host must fail the step; recorded ${JSON.stringify(run.recorded)}`,
  );
  assert.equal(run.launched, false, "the host is refused before this job adds an emulator to it");
  assert.doesNotMatch(run.recorded, /^serial=/m, `recorded ${JSON.stringify(run.recorded)}`);
});

test("a launch that died boots nothing, and the step refuses instead of asking adb", (t) => {
  // The host is empty at the check above the launch: the only thing this job
  // could adopt is a device it never started, and the only evidence it has is
  // the process it left behind.
  const run = boot(t, { fails: true });
  assert.equal(run.launched, true, "this case is about the launch having been attempted");
  assert.notEqual(
    run.status,
    0,
    `a failed launch must fail the step; recorded ${JSON.stringify(run.recorded)}`,
  );
  assert.match(run.log, /cannot start/, "the emulator's own reason reaches the job log");
  assert.doesNotMatch(run.recorded, /^serial=/m, `recorded ${JSON.stringify(run.recorded)}`);
});

test("a device that appears beside this job's own is a host this job refuses", (t) => {
  // Another job's emulator shows up as `offline` once this one has started. This
  // job's own serial is ready, so a step that looked only for a ready device
  // would call this host its own and install on someone else's run.
  const run = boot(t, {
    appears: "emulator-5560\\toffline\\nemulator-5584\\tdevice\\n",
    boots: "emulator-5584",
  });
  assert.notEqual(
    run.status,
    0,
    `a second device on the host must fail the step; recorded ${JSON.stringify(run.recorded)}`,
  );
  assert.doesNotMatch(run.recorded, /^serial=/m, `recorded ${JSON.stringify(run.recorded)}`);
});

test("the serial this job publishes is the console port it claimed", (t) => {
  // The cure still has to work: a launch that lives, a device that boots on the
  // port the step asked for, and nothing else on the host is the one journey run
  // this repository depends on. A stub that answers only `-s <serial>` calls is
  // what makes this case fail again if any wait or question below the launch
  // goes unqualified — an unqualified adb call matches no branch above.
  const run = boot(t, {
    appears: "emulator-5584\\tdevice\\n",
    boots: "emulator-5584",
  });
  assert.equal(run.status, 0, run.log);
  assert.match(run.recorded, /^pid=\d+$/m, "teardown keeps the process it recorded");
  assert.equal(
    run.registered,
    "emulator-5584",
    "the launch has to claim the console port the step names, or this case is about nothing",
  );
  assert.match(
    run.recorded,
    /^serial=emulator-5584$/m,
    `the published device must be the one this step booted: ${JSON.stringify(run.recorded)}`,
  );
});
