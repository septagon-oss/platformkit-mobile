import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// The harness waits for the kernel it served to answer /health, with a bound of
// sixty turns. What happens at the end of that bound is the whole difference between
// a red that names the server and a red that names thirteen flows: a loop that simply
// ends would hand `scripts/e2e/run.sh` a port that holds nothing, and every journey
// would then be refused by its own timeout while the log said nothing about the server
// that never bound. So the bound refuses, prints what the kernel logged, and the
// journeys are not reached. The cases below plant the tools the harness asks for, and
// a kernel of their own — one that stays alive and answers nothing, one that answers —
// so what is under test is the branch after the wait and not a device or a database.

const checkout = path.join(import.meta.dirname, "..");
const port = "8734";
const pin = "cbaa47b4825a90d95d61b55f39ffdf7051adf1ba";

/** planted gives the harness a root of its own: the two scripts it reads by path, the tools it searches for, and a kernel written by the case. */
function planted(
  t: { after: (fn: () => void) => void },
  kernel: string,
  answers: boolean,
): { root: string; ran: string } {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-serve-bound-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const at of ["scripts/e2e/mobile_ci.sh", "scripts/e2e/tools.sh"]) {
    mkdirSync(path.join(root, path.dirname(at)), { recursive: true });
    writeFileSync(path.join(root, at), readFileSync(path.join(checkout, at)), { mode: 0o755 });
  }
  mkdirSync(path.join(root, "testdata"), { recursive: true });
  for (const at of ["catalog.source.json", "openapi.source.json"]) {
    writeFileSync(
      path.join(root, "testdata", at),
      `${JSON.stringify({ upstream: { commit: pin } })}\n`,
    );
  }
  // The last mile is the thing the bound must not reach, so it leaves a mark rather
  // than an install: no adb, no emulator and no Maestro is anywhere near this case.
  const ran = path.join(root, "journeys-ran");
  writeFileSync(path.join(root, "scripts/e2e/run.sh"), `#!/bin/sh\ntouch '${ran}'\n`, {
    mode: 0o755,
  });
  const bin = path.join(root, "bin");
  mkdirSync(bin, { recursive: true });
  const tools: Record<string, string> = {
    // psql answers, because the harness creates its database before it serves.
    psql: "#!/bin/sh\nexit 0\n",
    // curl answers what the case says it should.
    curl: answers ? "#!/bin/sh\nexit 0\n" : "#!/bin/sh\nexit 22\n",
    // sleep returns at once, so sixty turns of the wait are sixty turns, not sixty seconds.
    sleep: "#!/bin/sh\nexit 0\n",
  };
  for (const [name, body] of Object.entries(tools)) {
    writeFileSync(path.join(bin, name), body, { mode: 0o755 });
  }
  writeFileSync(path.join(root, "platformkit"), kernel, { mode: 0o755 });
  return { root, ran };
}

/** serve runs the harness's whole serve half against one planted root. */
function serve(root: string): { status: number; out: string; err: string } {
  const got = spawnSync(path.join(root, "scripts/e2e/mobile_ci.sh"), ["verification.apk"], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
    env: {
      PATH: `${path.join(root, "bin")}:/usr/bin:/bin`,
      HOME: root,
      PK_KERNEL_BIN: path.join(root, "platformkit"),
      PLATFORMKIT_TEST_ADMIN_URL: "postgres://postgres:x@postgres:5432/platformkit?sslmode=disable",
      PLATFORMKIT_TEST_DATABASE_URL:
        "postgres://platformkit_app:x@postgres:5432/platformkit?sslmode=disable",
      PLATFORMKIT_TEST_NATS_URL: "nats://nats:4222",
      PLATFORMKIT_MOBILE_PORT: port,
      PK_MOBILE_REPORT: path.join(root, "report.xml"),
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
  });
  return { status: got.status ?? -1, out: got.stdout, err: got.stderr };
}

// Alive, logging one line, and never answering: the state the bound exists for. The
// sleep is named absolutely because the planted `sleep` that shortens the wait would
// otherwise shorten this process's life with it.
const silent = `#!/bin/sh\ncase "$1" in\n  run) echo "refusing to bind the pool" >&2; exec /bin/sleep 120 ;;\n  *) exit 0 ;;\nesac\n`;

test("a kernel alive and answering no /health ends the run naming the wait, the port and its own log", (t) => {
  const { root, ran } = planted(t, silent, false);
  const served = serve(root);
  assert.equal(served.status, 1, `the fall-through was the defect: ${served.out}${served.err}`);
  assert.match(served.err, /never answered \/health/, `the refusal names the wait: ${served.err}`);
  assert.ok(served.err.includes(port), `the refusal names the port: ${served.err}`);
  assert.ok(served.err.includes(pin), `the refusal says which build it waited for: ${served.err}`);
  assert.ok(
    served.err.includes("refusing to bind the pool"),
    `the kernel's own log is the sentence a configuration problem is said in: ${served.err}`,
  );
  assert.ok(
    !existsSync(ran),
    "the journeys were reached: a run with no server must not ask a device to sign in",
  );
});

test("the same harness reaches the journeys when the served kernel answers /health", (t) => {
  const { root, ran } = planted(t, silent, true);
  const served = serve(root);
  assert.equal(served.status, 0, `${served.out}${served.err}`);
  assert.ok(existsSync(ran), "an answering kernel must reach the last mile");
});
