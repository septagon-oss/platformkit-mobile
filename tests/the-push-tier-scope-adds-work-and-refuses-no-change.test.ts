// The push tier is a faster first answer, never a second gate: `npm run check` is the required check, and
// the scope step only chooses which of its files to run first (0088 rule 5: contract plus the behaviour of
// the packages the diff reaches). A production file the diff touches that no suite imports — a route file
// under app/, which the router mounts and a flow claims — is named so a reader sees the hole, and the step
// exits zero, because a change the merge tier accepts is not refused by the tier that exists to run less of
// it. Sixteen files of this repository are reached by no import today, every `app/` route among them, so a
// scope that exited non-zero on one would refuse every change to the home screen before `npm run check` ran.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
/** TIERS is the push tier's own entry point, run the way `npm run test:scope` runs it. */
const TIERS = path.resolve("scripts/tiers.ts");
/** TSX is the loader `npm run test:scope` runs under, by its path, so a scratch checkout needs no install. */
const TSX = pathToFileURL(require.resolve("tsx")).href;

/**
 * checkout is a repository small enough to read at once: one derivation with a test over it, one route file
 * no test imports and a flow that claims it, committed, and then one commit that changes only the route.
 */
function checkout(after: (fn: () => void) => void): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-push-tier-"));
  after(() => rmSync(root, { recursive: true, force: true }));
  const write = (at: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, at)), { recursive: true });
    writeFileSync(path.join(root, at), text);
  };
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=suite",
        "-c",
        "user.email=suite@example.invalid",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd: root, stdio: "pipe" },
    );
  write("src/core/state.ts", "export const reduce = 0;\n");
  write(
    "tests/derive.test.ts",
    'import { reduce } from "../src/core/state";\ntest("derive", () => {});\n',
  );
  write("app/index.tsx", "export default () => null;\n");
  write("e2e/flows/home.yaml", "# screen: app/index.tsx\nappId: x\n---\n- launchApp\n");
  git("init", "-q");
  git("add", ".");
  git("commit", "-q", "-m", "the base");
  write("app/index.tsx", "export default () => 1;\n");
  git("commit", "-q", "-am", "the home route changes");
  return root;
}

test("a diff that touches a route file no suite imports is scoped, not refused", (t) => {
  const root = checkout((fn) => t.after(fn));
  const run = spawnSync(process.execPath, ["--import", TSX, TIERS, "--diff", "HEAD~1"], {
    cwd: root,
    encoding: "utf8",
  });
  // The scope read the diff: one changed file, whatever it decided about it. This line is printed on both
  // sides of the rule, so a crash before the decision can never pass for the cure.
  assert.match(run.stdout, /^push tier: 1 changed files reach /m, run.stderr);
  // The step may name the hole — that is what the README promises — but a name is a line a reader acts on,
  // and the exit status is the one thing CI acts on: `npm run check` decides this change, not the scope.
  assert.equal(
    run.status,
    0,
    `the push tier's scope refused a change the merge tier would run:\n${run.stdout}${run.stderr}`,
  );
});
