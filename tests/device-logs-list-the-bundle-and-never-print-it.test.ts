import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Maestro's debug bundle can hold what a journey typed — a password, a factor
// code — so the job keeps it as an artifact and the job log only says which files
// it holds and how large each is. The diagnostics script is run as the step runs
// it, with adb a shell function, and a bundle file carrying a value that must not
// reach the job log.

const checkout = path.join(import.meta.dirname, "..");

const device = `adb() {
  case "$1" in
    devices) printf 'List of devices attached\\nemulator-5584\\tdevice\\n' ;;
    -s)
      case "$*" in
        *getprop*) printf '1\\r\\n' ;;
        *"-b crash"*) printf 'E/AndroidRuntime(  142): FATAL EXCEPTION: main\\r\\n' ;;
      esac ;;
  esac
}
export -f adb
`;

test("the job log names each file of Maestro's bundle and its size, and never what it holds", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-device-bundle-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const debug = path.join(root, "debug");
  mkdirSync(debug);
  const typed = "typed-secret-4f9c2a";
  const commands = path.join(debug, "commands-(sign-in).json");
  writeFileSync(commands, `{"inputText":"${typed}"}\n`);
  const result = spawnSync("bash", ["-e", "-c", `${device}scripts/e2e/device_logs.sh`], {
    cwd: checkout,
    encoding: "utf8",
    timeout: 20000,
    env: {
      ...process.env,
      ANDROID_SERIAL: "emulator-5584",
      PK_MOBILE_DIAGNOSTICS: path.join(root, "device"),
      PK_MOBILE_DEBUG_DIR: debug,
    },
  });
  assert.equal(
    result.error,
    undefined,
    `the step must answer inside its timeout: ${result.stderr}`,
  );
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(
    result.stdout,
    /FATAL EXCEPTION: main/,
    "the device's own lines do reach the job log",
  );
  const size = Buffer.byteLength(`{"inputText":"${typed}"}\n`);
  assert.ok(
    result.stdout.includes(`${size} ${commands}`),
    `the bundle's file is listed with its size: ${result.stdout}`,
  );
  assert.ok(
    !`${result.stdout}${result.stderr}`.includes(typed),
    "what a journey typed stays in the artifact and never reaches the job log",
  );
});
