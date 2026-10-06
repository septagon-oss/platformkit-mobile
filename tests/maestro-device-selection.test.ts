import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("the flow runner sends Maestro to the same named device as adb", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-maestro-device-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const apk = path.join(root, "fixture.apk");
  const maestro = path.join(root, "maestro");
  writeFileSync(apk, "fixture");
  writeFileSync(
    maestro,
    '#!/usr/bin/env node\nrequire("node:fs").writeFileSync(process.env.MAESTRO_ARGUMENTS, JSON.stringify(process.argv.slice(2)));\n',
    { mode: 0o755 },
  );
  // Exported shell functions take precedence over the SDK discovery paths.
  // No real adb daemon, device or Maestro process is used by this case.
  const result = spawnSync(
    "bash",
    [
      "-c",
      `adb() {
  printf '%s\\n' "$*" >> "$ADB_ARGUMENTS"
  if [ "$1" = devices ]; then
    printf 'List of devices attached\\nemulator-5554\\tdevice\\nemulator-5556\\tdevice\\n'
  fi
}
export -f adb
bash scripts/e2e/run.sh "$1"`,
      "device-test",
      apk,
    ],
    {
      encoding: "utf8",
      timeout: 10000,
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
        ANDROID_SERIAL: "emulator-5556",
        TENANT_HOST: "",
        MAESTRO: maestro,
        PK_MOBILE_REPORT: path.join(root, "report.xml"),
        ADB_ARGUMENTS: path.join(root, "adb.json"),
        MAESTRO_ARGUMENTS: path.join(root, "maestro.json"),
      },
    },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const adb = readFileSync(path.join(root, "adb.json"), "utf8");
  assert.match(adb, /-s emulator-5556 install -r/);
  const args: string[] = JSON.parse(readFileSync(path.join(root, "maestro.json"), "utf8"));
  const namedDevice = args.some(
    (arg, index) =>
      ((arg === "--device" || arg === "--udid") && args[index + 1] === "emulator-5556") ||
      arg === "--device=emulator-5556" ||
      arg === "--udid=emulator-5556",
  );
  assert.ok(
    namedDevice,
    `Maestro must select the installed device; received ${JSON.stringify(args)}`,
  );
});
