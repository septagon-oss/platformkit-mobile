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

/** refusingStub is a server that never answers: the state the bound exists for. */
const refusingStub = "#!/bin/sh\nexit 22\n";

/** answeringStub is /health and every route the harness asks on its way to run.sh. */
const answeringStub = `#!/bin/sh
out="" method=GET body="" url=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    -X) method="$2"; shift 2 ;;
    -d) body="$2"; shift 2 ;;
    -w|-H|-b|-c) shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
route="/\${url#http://localhost:*/}"
[ "$route" = "/health" ] && exit 0
user="44444444-4444-4444-8444-444444444444"
status=599 answer='{"detail":"the stub server stops here"}'
case "$method $route" in
  "GET /api/v1/auth/factors") status=200 answer='{"items":[]}' ;;
  "GET /api/v1/auth/me") status=200 answer='{"roles":["admin"]}' ;;
  "POST /api/v1/user/users") status=201 answer='{"id":"'"$user"'"}' ;;
  "POST /api/v1/user/users/$user/roles") status=200 answer='{}' ;;
  "POST /api/v1/user/users/$user/set-password") status=200 answer='{}' ;;
  "POST /api/v1/auth/factors/totp/begin") status=200 answer='{"secret":"JBSWY3DPEHPK3PXP"}' ;;
  "POST /api/v1/auth/factors/totp/finish") status=201 answer='{"codes":["000000000001"]}' ;;
  "POST /api/v1/auth/challenge/verify") status=200 answer='{}' ;;
  "POST /api/v1/auth/login")
    case "$body" in
      *'"email":"factor@e2e.test"'*)
        if [ -f "$FACTOR_SIGNED_IN" ]; then
          detail=$(sed -n '/^export const FACTOR_REQUIRED_DETAIL =/{n;s/^[[:space:]]*"\\(.*\\)";$/\\1/;p}' src/core/signInOutcome.ts)
          status=401 answer='{"detail":"'"$detail"'"}' 
        else
          touch "$FACTOR_SIGNED_IN"
          status=200 answer='{"roles":["admin"]}'
        fi ;;
      *) status=200 answer='{"roles":["admin"]}' ;;
    esac ;;
esac
[ -n "$out" ] && printf '%s' "$answer" > "$out"
printf '%s' "$status"
`;

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
  // The harness reads three things by path rather than carrying its own copy: the
  // tools helper, the sentence a second factor is recognised by
  // (src/core/signInOutcome.ts) and the prover that computes a code at this
  // instant, so the planted root holds all three.
  for (const at of [
    "scripts/e2e/mobile_ci.sh",
    "scripts/e2e/tools.sh",
    "scripts/e2e/totp.py",
    "src/core/signInOutcome.ts",
  ]) {
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
    // curl answers what the case says it should. The answering stub is a server for
    // the routes the harness walks before it reaches the journeys — the administrator
    // sign-in, the factor person's create/roles/set-password, the enrolment, and the
    // prove leg — because reaching run.sh means passing every one of them. Its 401
    // carries the sentence read out of the phone's own copy, which is the read
    // mobile_ci.sh performs, so stub and harness cannot drift in what a second factor
    // is said in.
    curl: answers ? answeringStub : refusingStub,
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
      FACTOR_SIGNED_IN: path.join(root, "factor-signed-in"),
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
