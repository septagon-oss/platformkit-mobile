// tiers.ts answers the two questions 0088 rule 5 leaves open for this repository, from one implementation:
// which test files does a diff reach (the push tier's scope), and which tests cost the most (the nightly
// tier's slowest-tests and flake reports). It reads the suite's own imports and tests/inventory.json, and
// decides nothing about whether a file runs: `npm run check` remains the required check and the merge tier,
// and it always runs both suites whatever this prints.
//
// Entered as `npm run test:scope --diff <base> [--run]` and `npm run report:tests`.
import { existsSync, readFileSync, readdirSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { readTable, type Row } from "./inventory";

/** IMPORT is every static hop a file takes to another file: `from "…"`, `require("…")`, `import("…")`. */
const IMPORT = /(?:from\s+|require\(|import\()["'](\.[^"']+)["']/g;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)],
  );
}

/** suiteFiles is every test file a runner in `npm test` reaches, as paths under tests/. */
export function suiteFiles(root: string): { node: string[]; jest: string[] } {
  const all = existsSync(path.join(root, "tests"))
    ? walk(path.join(root, "tests")).map((f) => path.relative(root, f))
    : [];
  return {
    node: all.filter((f) => /^tests\/[^/]+\.test\.ts$/.test(f)).sort(),
    jest: all.filter((f) => /^tests\/.*\.test\.tsx$/.test(f)).sort(),
  };
}

/** resolveFile answers what one relative import points at: the file, or with .ts/.tsx/.js or /index added. */
function resolveFile(root: string, from: string, specifier: string): string | null {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.ts`,
  ])
    // A directory is no module: `from ".."` names one, and reading it is a crash, not an import.
    if (statSync(path.join(root, candidate), { throwIfNoEntry: false })?.isFile()) return candidate;
  return null;
}

/** importsOf is the files one file reaches in one hop, resolved against this checkout. */
function importsOf(root: string, file: string): string[] {
  const src = readFileSync(path.join(root, file), "utf8");
  const out: string[] = [];
  for (const m of src.matchAll(IMPORT)) {
    const target = resolveFile(root, file, m[1]!);
    if (target) out.push(target);
  }
  return out;
}

/**
 * importers maps every file to the test files that reach it, transitively: a change to a molecule reaches the
 * suite that imports it directly and the one that imports the organism that imports it. The walk is over the
 * repository's own files, so a rename is a smaller import set and not a silent gap, and nothing is trusted
 * out of the inventory's `loaded` column — that column is a count of what one run loaded, not a list.
 */
export function importers(root: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const record = (file: string, test: string): void => {
    const set = map.get(file) ?? new Set<string>();
    set.add(test);
    map.set(file, set);
  };
  const suite = suiteFiles(root);
  for (const test of [...suite.node, ...suite.jest]) {
    // The walk is breadth-first over one test file's imports, and every file it reaches
    // answers to that test: the molecule is reached through the organism that mounts it.
    const seen = new Set<string>();
    record(test, test);
    let frontier = importsOf(root, test);
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const file of frontier) {
        if (seen.has(file)) continue;
        seen.add(file);
        record(file, test);
        next.push(...importsOf(root, file));
      }
      frontier = next;
    }
  }
  return map;
}

/** changedAgainst is every path the diff to `base` touches, read from git. */
export function changedAgainst(root: string, base: string): string[] {
  const out = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
    cwd: root,
    encoding: "utf8",
  });
  return out.split("\n").filter((l) => l.length > 0);
}

/** Scope is the push tier's choice: which test files a diff reaches, and what no test reaches at all. */
export interface Scope {
  node: string[];
  jest: string[];
  untested: string[];
}

/** reachedBy names the test files a set of changed files reaches, and the production files none of them does. */
export function reachedBy(root: string, changed: string[]): Scope {
  const map = importers(root);
  const node = new Set<string>();
  const jest = new Set<string>();
  const untested: string[] = [];
  const suite = suiteFiles(root);
  for (const file of changed) {
    if (
      /^(testdata|docs|design|\.github|\.gitea)\//.test(file) ||
      /^(README|AGENTS|CLEANUP|CHANGELOG|LICENSE|NOTICE)\.md?$/.test(file)
    )
      continue;
    const holders = map.get(file);
    if (!holders || holders.size === 0) {
      // A file no test imports is either a document, a script nobody runs, or a hole in the suite. Only the
      // last of the three is worth a line, and only for the trees the suite is meant to cover.
      if (/^(src|app)\//.test(file)) untested.push(file);
      continue;
    }
    for (const test of holders) (suite.jest.includes(test) ? jest : node).add(test);
  }
  return { node: [...node].sort(), jest: [...jest].sort(), untested: untested.sort() };
}

/** runScope runs what the diff reached, one process for each half, and says so when a half holds nothing. */
export function runScope(root: string, scope: Scope): void {
  if (scope.node.length > 0)
    execFileSync("node", ["--import", "tsx", "--test", ...scope.node], {
      cwd: root,
      stdio: "inherit",
    });
  else
    console.log(
      "node suite: the diff reaches no file in it, so the merge tier is the one that runs it",
    );
  if (scope.jest.length > 0)
    execFileSync("npx", ["jest", ...scope.jest], { cwd: root, stdio: "inherit" });
  else
    console.log(
      "component suite: the diff reaches no suite in it, so the merge tier is the one that runs it",
    );
}

/** Report is the nightly tier's publication: the costliest files and tests, and where anything failed. */
export function report(rows: Row[]): string {
  const run = rows.filter((r) => r.runner === "node" || r.runner === "jest");
  const byFile = [...run]
    .sort((a, b) => ((b.ms as number | undefined) ?? 0) - ((a.ms as number | undefined) ?? 0))
    .slice(0, 20)
    .map((r) => ({ file: r.file, layer: r.layer, ms: r.ms, testsMs: r.testsMs, cases: r.cases }));
  const byTest = rows
    .flatMap((r) =>
      ((r.tests as { title?: string; isolatedMs?: number; ms?: number }[] | undefined) ?? []).map(
        (t) => ({
          file: r.file,
          title: t.title,
          isolatedMs: t.isolatedMs ?? t.ms ?? null,
        }),
      ),
    )
    .filter((t) => typeof t.isolatedMs === "number")
    .sort((a, b) => (b.isolatedMs as number) - (a.isolatedMs as number))
    .slice(0, 20);
  const flaky = rows
    .filter((r) => ((r.flakyRuns as string[] | undefined)?.length ?? 0) > 0)
    .map((r) => ({ file: r.file, runs: r.flakyRuns }));
  return JSON.stringify(
    {
      schema: 1,
      unit: "wall time and per-test time in milliseconds, taken by the run that wrote tests/inventory.json",
      slowestFiles: byFile,
      slowestTests: byTest,
      flaky,
      unreachable: rows.filter((r) => r.runsNowhere).map((r) => r.file),
    },
    null,
    1,
  );
}

if (process.argv[1]?.endsWith("tiers.ts")) {
  const root = process.cwd();
  const args = process.argv.slice(2);
  if (args[0] === "--diff") {
    const base = args[1];
    if (!base) {
      console.error("--diff needs a revision to read the change against");
      process.exit(1);
    }
    const changed = changedAgainst(root, base);
    const scope = reachedBy(root, changed);
    console.log(
      `push tier: ${changed.length} changed files reach ${scope.node.length} node files and ${scope.jest.length} component suites`,
    );
    for (const f of [...scope.node, ...scope.jest]) console.log(`  ${f}`);
    for (const f of scope.untested)
      console.error(`${f}: changed and no test file in the repository imports it`);
    if (scope.untested.length > 0) process.exit(1);
    if (args.includes("--run")) runScope(root, scope);
  } else if (args[0] === "--report") {
    const json = report(readTable(root).rows);
    const at = path.join(process.env.PK_TEST_REPORT_DIR ?? "out", "slowest-tests.json");
    mkdirSync(path.dirname(at), { recursive: true });
    writeFileSync(at, json + "\n");
    console.log(
      `${at}: the 20 costliest files, the 20 costliest tests, ${json.split('"runs"').length - 1} flaky rows`,
    );
  } else {
    console.error("usage: tiers.ts --diff <base> [--run] | --report");
    process.exit(2);
  }
}
