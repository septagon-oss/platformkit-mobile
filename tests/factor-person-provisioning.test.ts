// The device harness creates the person who answers the second factor, and the
// kernel it serves accepts that person.
//
// At the commit testdata/openapi.source.json pins, POST /api/v1/user/users
// refuses a body that names roles — "crud: invalid: roles belongs to a route of
// its own, not to this one" — and roles are given at user-user-roles,
// POST /api/v1/user/users/{id}/roles. The stub server below answers with that
// rule and nothing more; as in mobile-factor-config, exported functions replace
// psql and curl and the case writes its own kernel stub for PK_KERNEL_BIN, so no
// database, server or emulator starts. The job builds that binary from the pinned
// commit (this repository holds no Go toolchain); everything the harness does with
// it — copy it into its run directory, bootstrap, serve, wait — is what runs here.
// It stops the harness at the first request after the person has a password.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("the device harness creates its factor person in a shape the kernel accepts", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-factor-person-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const requests = path.join(root, "requests.log");
  // The kernel the harness serves: a file this case wrote, which boots quietly and
  // stays alive so the /health wait passes. It is a build of nothing.
  const kernelStub = path.join(root, "platformkit");
  writeFileSync(
    kernelStub,
    `#!/usr/bin/env bash
case "$1" in
  bootstrap) exit 0 ;;
  run) exec sleep 20 ;;
esac
`,
    { mode: 0o755 },
  );
  const result = spawnSync(
    "bash",
    [
      "-c",
      `psql() { :; }
curl() {
  local out="" method=GET body="" url=""
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
  local route="\${url#http://localhost:*/}"
  route="/\${route}"
  [ "$route" = "/health" ] && return 0
  printf '%s %s %s\\n' "$method" "$route" "$body" >> "$REQUESTS"
  local status=599 answer='{"detail":"the stub server stops here"}'
  case "$method $route" in
    "POST /api/v1/auth/login") status=200 answer='{"roles":["admin"]}' ;;
    "GET /api/v1/auth/factors") status=200 answer='{"items":[]}' ;;
    "GET /api/v1/auth/me") status=200 answer='{"roles":["admin"]}' ;;
    "POST /api/v1/user/users")
      case "$body" in
        *'"roles"'*) status=422 answer='{"detail":"crud: invalid: roles belongs to a route of its own, not to this one"}' ;;
        *) status=201 answer='{"id":"44444444-4444-4444-8444-444444444444"}' ;;
      esac ;;
    "POST /api/v1/user/users/44444444-4444-4444-8444-444444444444/roles") status=200 answer='{}' ;;
    "POST /api/v1/user/users/44444444-4444-4444-8444-444444444444/set-password") status=200 answer='{}' ;;
  esac
  [ -n "$out" ] && printf '%s' "$answer" > "$out"
  printf '%s' "$status"
}
export -f psql curl
bash scripts/e2e/mobile_ci.sh fixture.apk`,
    ],
    {
      encoding: "utf8",
      timeout: 30000,
      env: {
        ...process.env,
        TMPDIR: root,
        REQUESTS: requests,
        PLATFORMKIT_MOBILE_PORT: "8399",
        PLATFORMKIT_TEST_ADMIN_URL: "postgres://localhost/admin",
        PLATFORMKIT_TEST_DATABASE_URL: "postgres://localhost/app",
        PK_KERNEL_BIN: kernelStub,
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
    },
  );
  const sent = readFileSync(requests, "utf8").trim().split("\n");
  const created = sent.filter((line) => line.startsWith("POST /api/v1/user/users "));
  assert.equal(created.length, 1, result.stdout + result.stderr + sent.join("\n"));
  assert.doesNotMatch(created[0]!, /"roles"/, "the person is created without a roles member");
  assert.ok(
    sent.some((line) =>
      line.startsWith("POST /api/v1/user/users/44444444-4444-4444-8444-444444444444/set-password"),
    ),
    "the harness goes on to give the created person a password\n" + result.stderr,
  );
});
