// inventory.ts owns the record of what this repository's suite proves: one row per test file, with the
// layer the file belongs to, the tier that layer runs at, what the file costs, and the verdict proposed for
// it (0088). The table is written once by measurement and re-checked on every push: this unit re-derives the
// *shape* of every row — which files exist, which runner reaches each, which layer it is in, what it says it
// proves — and refuses a table that no longer answers the checkout, because the numbers in it were taken at
// one head and cannot be re-taken cheaply. It never decides whether a file runs: a file runs only because its
// runner's own glob or testMatch reaches it, so a wrong row can never silence a test.
//
// Entered as `npm run check:inventory` (the refusal) and `npm run inventory` (the rewrite). Its CLI shape is
// scripts/check_flows.ts's: exported functions that answer with refusals as strings, a command line that
// prints them and exits 1, and nothing else.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

export const LAYERS = ["contract", "behaviour", "composition", "journey"] as const;
export type Layer = (typeof LAYERS)[number];
export type Runner = "node" | "jest" | "browser" | "maestro";
export type Verdict = "keep" | "merge" | "delete";

/** LayerTotal is one row of the per-layer summary the table's own header quotes. */
export interface LayerTotal {
  files: number;
  cases: number;
  ms: number;
  testsMs: number;
  runners: Record<string, number>;
  unreachable: number;
}

/**
 * Row is one test file. The measured columns (`ms`, `testsMs`, `loaded`, `coveredProdLines`, `only*`,
 * `flakyRuns`, and a `tests[]` entry's `isolatedMs`) were taken by the commands named under `measured` and
 * are a record, not a re-check; the rest is re-derived from the file on every run. An index signature keeps
 * a row's extra fields — a flow's `claims`, a browser case's `needsEnv`, a merge's `sibling` — in the one
 * object, so re-emitting the table loses nothing.
 */
export interface Row {
  file: string;
  runner: Runner;
  layer: Layer;
  tier: string;
  reach: string;
  runsNowhere: boolean;
  cases: number | null;
  rule: string;
  ruleSource: string;
  verdict: Verdict;
  verdictReason: string;
  [key: string]: unknown;
}

/** Table is tests/inventory.json whole. */
export interface Table {
  schema: number;
  unit: string;
  measured: Record<string, unknown>;
  forge: Record<string, unknown>;
  baseline: Record<string, number>;
  totals: Record<string, LayerTotal>;
  rows: Row[];
  [key: string]: unknown;
}

export const JSON_PATH = "tests/inventory.json";
export const MD_PATH = "tests/INVENTORY.md";

/**
 * NODE_GLOB, JEST_GLOB and BROWSER_GLOBS are the discovery each runner actually applies. The first two are
 * copied from `package.json`'s `test` script and `jest.config.js`'s `testMatch`, so a runner that started or
 * stopped reaching a file would be a refusal here before it was a silent gap; the third names the files no
 * runner reaches at all, which the table has to carry because 0088 inventories every test, run or not.
 */
const NODE_GLOB = /^tests\/[^/]+\.test\.ts$/;
const JEST_GLOB = /^tests\/.*\.test\.tsx$/;
const BROWSER_GLOBS = [
  /^tests\/[^/]+\.case\.mjs$/,
  /^tests\/[^/]+\.spec\.ts$/,
  /^tests\/.*\.case\.tsx$/,
];

/** REVIEW_NAMED is 0072's refuse-the-round's-name rule, restated here only as a count that may not rise. */
const REVIEW_NAMED =
  /(?:^|\/)(?:review[-_]|round\d+[-_]|probe[-_])[^/]*\.(?:test|spec|case)\.[cm]?[jt]sx?$/;

/** TIERS is 0088 rule 5 read against this repository's runners: what a layer costs decides where it runs. */
export const TIERS: Record<Layer, string> = {
  contract: "push",
  behaviour: "push(scoped)+merge(full)",
  composition: "merge",
  journey: "nightly",
};

const LAYER_JOBS: Record<Layer, string> = {
  contract:
    "the wire: the pinned OpenAPI/catalogue/design-token documents, the generated client, the published surface",
  behaviour: "one rule of `src/core` or one component, named for the rule",
  composition: "the mounted app: shell + router + screen together",
  journey: "what a person does on a device or in a browser",
};

const LAYER_TIER_TEXT: Record<Layer, string> = {
  contract: "push, first",
  behaviour: "push (scoped to the packages the diff reaches), full at merge",
  composition: "merge",
  journey: "nightly / before a release",
};

/** The tool scripts whose subject is the wire, the manifest or the native project. */
const CONTRACT_SCRIPTS = [
  "scripts/api",
  "scripts/catalog",
  "scripts/tokens",
  "scripts/publish",
  "scripts/source",
  "scripts/fingerprint",
  "scripts/references",
  "scripts/android",
  "scripts/kernel_main",
  "scripts/advisories",
  "scripts/inventory",
];

/**
 * CONTRACT_NAME is a file named for that job rather than for a rule of the app. It is only read when the
 * file imports no test double: a file that drives `tests/fakes` is testing the app's answer to a wire
 * condition, which is behaviour whatever its name says.
 */
const CONTRACT_NAME =
  /^(api|openapi|catalog-|catalog\.|golden|contract|tokens?\.|publish|source|fingerprint|sdk|semver|drift|advisor|android|kernel-main|package|inventory)/;
const COMPOSE_WORDS = /\bshell\b|\broute|router|composition|every screen|the app\b/i;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)],
  );
}

/** everyFile is every path under the tree the table speaks for: `tests/` and the flow directory. */
function everyFile(root: string): string[] {
  const out: string[] = [];
  for (const at of ["tests", "e2e/flows"]) {
    if (!existsSync(path.join(root, at))) continue;
    if (statSync(path.join(root, at)).isFile()) out.push(at);
    else for (const f of walk(path.join(root, at))) out.push(path.relative(root, f));
  }
  return out.sort();
}

/** runnerOf names who executes a file today; `browser` is the honest word for nobody in this repository does. */
export function runnerOf(file: string): Runner | null {
  if (NODE_GLOB.test(file)) return "node";
  if (JEST_GLOB.test(file)) return "jest";
  if (BROWSER_GLOBS.some((g) => g.test(file))) return "browser";
  if (/^e2e\/flows\/[^/]+\.ya?ml$/.test(file)) return "maestro";
  return null;
}

/** discovered is every file the table owes a row to, in path order. */
export function discovered(root: string): string[] {
  return everyFile(root).filter((f) => runnerOf(f) !== null);
}

function text(root: string, file: string): string {
  return readFileSync(path.join(root, file), "utf8");
}

/**
 * layerOf answers 0088's four layers as a decision list over what the file reads, never over its prose: a
 * file whose text merely mentions "catalog" is not a contract test, and a file that reads a pinned document
 * or drives a tool script is. journey first (a flow or a browser specimen proves what a person sees), then
 * composition (it mounts the shell, the router, or a screen through the router/shell doubles), then contract,
 * then behaviour. Reading `testdata/catalog.json` as *input data* is behaviour: the contract layer is where
 * the pinned document, the generated client or the published manifest **is** the thing under test.
 */
export function layerOf(root: string, file: string, runner: Runner): Layer {
  if (runner === "maestro" || runner === "browser") return "journey";
  const src = text(root, file);
  const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
  const joined = imports.join(" ").replace(/\.\.\//g, "");
  if (
    joined.includes("src/shell") ||
    joined.includes("src/route") ||
    joined.includes("fakes/shell") ||
    joined.includes("fakes/router")
  )
    return "composition";
  if (
    COMPOSE_WORDS.test(src.slice(0, 1200)) &&
    (joined.includes("src/screens/") || joined.includes("src/renderers"))
  )
    return "composition";
  if (CONTRACT_SCRIPTS.some((s) => joined.includes(s))) return "contract";
  if (/src\/generated|testdata\/[A-Za-z\-.]+\.source\.json/.test(src)) return "contract";
  if (CONTRACT_NAME.test(path.basename(file)) && !joined.includes("fakes/")) return "contract";
  return "behaviour";
}

/**
 * firstComment is the rule a file states for itself before it imports anything (0072): the run of comment
 * lines at the top, `#` in a flow and `//` elsewhere. A flow's `# screen:` line is metadata about coverage,
 * not a rule, so it is skipped rather than quoted.
 */
export function firstComment(root: string, file: string): string {
  const marker = file.endsWith(".yaml") || file.endsWith(".yml") ? "#" : "/";
  const out: string[] = [];
  for (const line of text(root, file).split("\n").slice(0, 40)) {
    const s = line.trim();
    if (s.startsWith(marker) && !/^#\s*screen:/.test(s))
      out.push(s.replace(new RegExp(`^[${marker} ]+`), "").trim());
    else if (out.length > 0) break;
  }
  return out.join(" ");
}

/** staticCases is the case count readable without a runner: one journey per flow, one `test(` per browser specimen. */
function staticCases(root: string, file: string, runner: Runner): number | null {
  if (runner === "maestro") return 1;
  if (runner === "browser") return [...text(root, file).matchAll(/^\s*test\(/gm)].length;
  return null;
}

/** reachOf says, for the file itself, which runner reaches it and what would have to change not to. */
function reachOf(file: string, runner: Runner): string {
  if (runner === "node") return "npm test (node half)";
  if (runner === "jest") return "npm test (jest half)";
  if (runner === "maestro")
    return "emulator job only (mobile-e2e.yml): every run of main read from the forge failed there";
  return file.endsWith(".case.tsx")
    ? "no runner: matches neither jest's testMatch (.test.tsx only) nor the node glob; its own header names the failing assertion it waits on"
    : "no runner: needs REVIEW_GALLERY_URL + PLAYWRIGHT_MODULE (Playwright is not a dependency)";
}

/**
 * Shape is what `--check` re-derives from a file and what `--sync` writes for a row that has none yet. It is
 * deliberately not the whole row: the measured columns are a record of one head and this unit does not
 * pretend to re-take them.
 */
export interface Shape {
  runner: Runner;
  layer: Layer;
  tier: string;
  reach: string;
  runsNowhere: boolean;
  rule: string;
  ruleSource: string;
  cases: number | null;
  extra: Record<string, unknown>;
}

export function shapeOf(root: string, file: string): Shape | null {
  const runner = runnerOf(file);
  if (runner === null) return null;
  const layer = layerOf(root, file, runner);
  const rule = firstComment(root, file);
  const extra: Record<string, unknown> = {};
  if (runner === "maestro") {
    extra.claims = [...text(root, file).matchAll(/^#\s*screen:\s*(.+)$/gm)].map((m) =>
      m[1]!.trim(),
    );
    extra.steps = text(root, file).split("---").length - 1;
  }
  if (runner === "browser")
    extra.needsEnv = ["PLAYWRIGHT_MODULE", "REVIEW_GALLERY_URL"].filter((k) =>
      text(root, file).includes(k),
    );
  return {
    runner,
    layer,
    tier: TIERS[layer],
    reach: reachOf(file, runner),
    runsNowhere: reachOf(file, runner).startsWith("no runner"),
    rule: rule,
    ruleSource: rule === "" ? "first test title" : "first comment",
    cases: staticCases(root, file, runner),
    extra,
  };
}

/** ruleFallback is what the rule column holds for a file that states none — its first title, labelled. */
function ruleFallback(row: Row): string {
  const titles = (row.titles as string[] | undefined) ?? [];
  return `(no first comment; first test title) ${titles[0] ?? "—"}`;
}

export function readTable(root: string): Table {
  return JSON.parse(text(root, JSON_PATH)) as Table;
}

/** totalsOf re-derives the per-layer summary from the rows, in the row order the table stores them. */
export function totalsOf(rows: Row[]): Record<string, LayerTotal> {
  const totals: Record<string, LayerTotal> = {};
  for (const r of rows) {
    const t = (totals[r.layer] ??= {
      files: 0,
      cases: 0,
      ms: 0,
      testsMs: 0,
      runners: {},
      unreachable: 0,
    });
    t.files += 1;
    t.cases += r.cases ?? 0;
    t.ms += (r.ms as number | null | undefined) ?? 0;
    t.testsMs += (r.testsMs as number | undefined) ?? 0;
    t.runners[r.runner] = (t.runners[r.runner] ?? 0) + 1;
    t.unreachable += r.runsNowhere ? 1 : 0;
  }
  return totals;
}

/** sortRows puts rows in (layer, runner, file) order, the order the totals above are summed in. */
export function sortRows(rows: Row[]): Row[] {
  return [...rows].sort(
    (a, b) =>
      LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer) ||
      a.runner.localeCompare(b.runner) ||
      (a.file < b.file ? -1 : a.file > b.file ? 1 : 0),
  );
}

const ROW_KEYS = new Set([
  "file",
  "runner",
  "layer",
  "tier",
  "reach",
  "runsNowhere",
  "cases",
  "rule",
  "ruleSource",
  "verdict",
  "verdictReason",
  "ms",
  "testsMs",
  "loaded",
  "coveredProdLines",
  "onlyProdLines",
  "onlyToolLines",
  "onlyFiles",
  "onlyLines",
  "onlyToolFiles",
  "flakyRuns",
  "titles",
  "tests",
  "testsUnique",
  "testsTotal",
  "claims",
  "steps",
  "needsEnv",
  "sibling",
  "mapping",
  "layerReason",
  "exclusiveNotMeasured",
]);
const TABLE_KEYS = new Set(["schema", "unit", "measured", "forge", "baseline", "totals", "rows"]);

/** checkInventory answers with every way the table fails to answer the checkout, empty when it answers it. */
export function checkInventory(root: string): string[] {
  const problems: string[] = [];
  if (!existsSync(path.join(root, JSON_PATH)))
    return [`${JSON_PATH}: the table is not there to check`];
  const table = readTable(root);
  for (const key of Object.keys(table))
    if (!TABLE_KEYS.has(key)) problems.push(`${JSON_PATH}: no column this unit reads: ${key}`);
  if (table.schema !== 1)
    problems.push(`${JSON_PATH}: schema ${table.schema} is no shape this unit reads`);

  const seen = new Map<string, Row>();
  for (const row of table.rows) {
    if (seen.has(row.file)) problems.push(`${row.file}: two rows for one file`);
    seen.set(row.file, row);
    for (const key of Object.keys(row))
      if (!ROW_KEYS.has(key)) problems.push(`${row.file}: no column this unit reads: ${key}`);
    if (!existsSync(path.join(root, row.file)))
      problems.push(`${row.file}: the row names a file this checkout does not hold`);
    if (!["keep", "merge", "delete"].includes(row.verdict))
      problems.push(`${row.file}: verdict ${row.verdict} is none of keep, merge or delete`);
    if (row.verdict !== "keep") {
      const sibling = row.sibling as string | undefined;
      const mapping = row.mapping as Record<string, string> | undefined;
      if (!sibling)
        problems.push(`${row.file}: a ${row.verdict} verdict names no sibling that keeps its rule`);
      else if (!seen.has(sibling) && !existsSync(path.join(root, sibling)))
        problems.push(`${row.file}: its sibling ${sibling} is no row of this table`);
      if (!mapping || Object.keys(mapping).length === 0)
        problems.push(
          `${row.file}: a ${row.verdict} verdict carries no assertion-to-successor mapping (0088)`,
        );
      else
        for (const title of (row.titles as string[] | undefined) ?? [])
          if (!(title in mapping))
            problems.push(
              `${row.file}: nothing keeps the assertion "${title}" (0088: line coverage is not assertions)`,
            );
    }
    if (!row.verdictReason)
      problems.push(`${row.file}: a verdict with no reason is an opinion (0088)`);
    if (row.layer === "contract" && row.layerReason === undefined && row.runner === "jest")
      problems.push(`${row.file}: a component suite in the contract layer needs a layerReason`);
    // The measured columns are a record; what is refused is a row that claims to hold one and does not.
    if (row.runner === "node" || row.runner === "jest") {
      const titles = (row.titles as string[] | undefined) ?? [];
      const tests = (row.tests as unknown[] | undefined) ?? [];
      if (typeof row.cases !== "number")
        problems.push(
          `${row.file}: a ${row.runner} row reads its case count from a run, so it must hold one`,
        );
      else {
        if (titles.length !== row.cases)
          problems.push(
            `${row.file}: ${titles.length} titles for ${row.cases} cases — the run names one per case`,
          );
        if (tests.length !== row.cases)
          problems.push(`${row.file}: ${tests.length} per-test rows for ${row.cases} cases`);
      }
      if (row.onlyProdLines === null || row.onlyProdLines === undefined)
        if (!row.exclusiveNotMeasured)
          problems.push(
            `${row.file}: no exclusive-line count and no exclusiveNotMeasured saying which pass would fill it`,
          );
      const unique =
        (row.tests as { measured?: boolean }[] | undefined)?.filter((t) => t.measured).length ?? 0;
      if (unique === row.cases && row.cases !== null) {
        if (typeof row.testsUnique !== "number" || typeof row.testsTotal !== "number")
          problems.push(`${row.file}: every test measured but no testsUnique/testsTotal to quote`);
        else if (row.testsTotal !== row.cases)
          problems.push(`${row.file}: testsTotal ${row.testsTotal} for ${row.cases} cases`);
      }
    }
  }

  // Shape: every file a runner reaches, and only those.
  const found = discovered(root);
  for (const file of found)
    if (!seen.has(file))
      problems.push(
        `${file}: no row — a test file the table does not answer for is a test nobody inventoried`,
      );
  for (const [file, row] of seen) {
    if (!found.includes(file)) continue;
    const shape = shapeOf(root, file)!;
    if (row.runner !== shape.runner)
      problems.push(
        `${file}: row says ${row.runner}, the runners' own globs reach it as ${shape.runner}`,
      );
    if (row.layer !== shape.layer && !row.layerReason)
      problems.push(
        `${file}: row says ${row.layer}, what it imports and reads answers ${shape.layer} (override with a layerReason)`,
      );
    if (row.tier !== TIERS[row.layer])
      problems.push(
        `${file}: a ${row.layer} row runs at ${TIERS[row.layer]}, its row says ${row.tier}`,
      );
    if (row.reach !== shape.reach)
      problems.push(`${file}: its row says ${row.reach}; what reaches it today is ${shape.reach}`);
    if (row.runsNowhere !== shape.runsNowhere)
      problems.push(`${file}: runsNowhere disagrees with the reach its own row states`);
    if (shape.cases !== null && row.cases !== shape.cases)
      problems.push(
        `${file}: ${shape.cases} ${row.runner === "maestro" ? "journey" : "cases"} read from the file, its row says ${row.cases}`,
      );
    if (row.ruleSource === "first comment" && row.rule !== shape.rule)
      problems.push(
        `${file}: the rule its row quotes is no longer the comment at the top of the file`,
      );
    if (row.ruleSource === "first test title" && shape.rule === "") {
      if (row.rule !== ruleFallback(row))
        problems.push(
          `${file}: its row's rule is no longer the first title of the file that states no rule`,
        );
    } else if (row.ruleSource !== "first comment" && row.ruleSource !== "first test title")
      problems.push(`${file}: ruleSource ${row.ruleSource} names no place a rule is read from`);
    for (const [key, want] of Object.entries(shape.extra))
      if (JSON.stringify(row[key]) !== JSON.stringify(want))
        problems.push(`${file}: ${key} in the row no longer answers what is in the file`);
  }

  // The two counts 0088 keeps as ratchets, each against the number the table records.
  const named = everyFile(root).filter((f) => REVIEW_NAMED.test(f));
  const reviewBaseline = table.baseline?.reviewNamed;
  if (typeof reviewBaseline !== "number")
    problems.push(`${JSON_PATH}: baseline.reviewNamed is the 0072 count to stay at`);
  else if (named.length > reviewBaseline)
    problems.push(
      `${named.join(", ")}: ${named.length} review-named ${named.length === 1 ? "file" : "files"}, the baseline is ${reviewBaseline} (0072)`,
    );
  const unreachable = seen.size ? [...seen.values()].filter((r) => r.runsNowhere).length : 0;
  const unreachableBaseline = table.baseline?.unreachable;
  if (typeof unreachableBaseline !== "number")
    problems.push(
      `${JSON_PATH}: baseline.unreachable is the count of files no runner reaches, to stay at`,
    );
  else if (unreachable > unreachableBaseline)
    problems.push(
      `${unreachable} files match no runner, the baseline is ${unreachableBaseline}: a file added to the suite has to be reached by a tier, not filed (0088 rule 5)`,
    );

  const want = totalsOf(sortRows(table.rows));
  for (const layer of Object.keys(want)) {
    const got = table.totals[layer];
    if (!got) problems.push(`${JSON_PATH}: totals hold no row for ${layer}`);
    else if (JSON.stringify(got) !== JSON.stringify(want[layer]))
      problems.push(
        `${JSON_PATH}: totals.${layer} is ${JSON.stringify(got)}, the rows answer ${JSON.stringify(want[layer])}`,
      );
  }
  for (const layer of Object.keys(table.totals))
    if (!want[layer]) problems.push(`${JSON_PATH}: totals name ${layer}, which no row is in`);
  return problems;
}

/** newRow is the row `--sync` writes for a file that has none: shape whole, measurement named but not claimed. */
function newRow(root: string, file: string): Row {
  const shape = shapeOf(root, file)!;
  const rule =
    shape.rule === "" ? "(the file states no rule; its first title will be read here)" : shape.rule;
  const row: Row = {
    file,
    runner: shape.runner,
    layer: shape.layer,
    cases: shape.cases,
    rule,
    ruleSource: shape.ruleSource,
    tier: shape.tier,
    reach: shape.reach,
    runsNowhere: shape.runsNowhere,
    verdict: "keep",
    verdictReason:
      `new since this table was measured: it states the rule above and runs where its layer runs; ` +
      `its cost and exclusive-line columns belong to the pass named under measured.${shape.runner}`,
  };
  Object.assign(row, shape.extra);
  if (shape.runner === "node" || shape.runner === "jest") {
    row.ms = null;
    row.exclusiveNotMeasured =
      "npm run inventory -- --measure " +
      file +
      " fills wall time, cases and titles from one run of this file";
    row.titles = [];
    row.tests = [];
    row.loaded = null;
    row.coveredProdLines = null;
    row.onlyProdLines = null;
  }
  return row;
}

/** sync adds a row for every reached file that has none and refuses to remove one: a row is only lost with a file (0088). */
export function sync(root: string): string[] {
  const table = readTable(root);
  const have = new Set(table.rows.map((r) => r.file));
  const added = discovered(root).filter((f) => !have.has(f));
  if (added.length > 0)
    table.rows = sortRows([...table.rows, ...added.map((f) => newRow(root, f))]);
  table.totals = totalsOf(table.rows);
  writeFileSync(path.join(root, JSON_PATH), emit(table) + "\n");
  writeFileSync(path.join(root, MD_PATH), renderMarkdown(root, table));
  return added;
}

/** emit writes the JSON the way the table was first written: non-ASCII escaped, one space of indent. */
function emit(value: unknown): string {
  return JSON.stringify(value, null, 1).replace(
    /[\u0080-\uffff]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}

/**
 * NODE_MEASURE is one file run alone, the way the table's node columns were taken: its own process, coverage
 * over the production tree only, so `loaded` and `coveredProdLines` mean what the other rows say they mean.
 */
const NODE_MEASURE = [
  "--import",
  "tsx",
  "--test",
  "--experimental-test-coverage",
  "--test-reporter=spec",
  "--test-coverage-include=src/**",
  "--test-coverage-include=app/**",
  "--test-coverage-include=scripts/**",
];

/** NODE_TITLE is one line of the runner's own report of a case it ran, with the duration it took. */
const NODE_TITLE = /^(?:✔|✖) (.+?)(?: \((\d+(?:\.\d+)?)ms\))?$/;

/**
 * COVERAGE_ROW is one line of the folder tree the runner prints under `start of coverage report`: every row
 * shows a basename and its depth by leading spaces, so the path is rebuilt from the nesting. A reconstructed
 * path that is no file on disk is dropped, because a parse may not invent a covered file.
 */
const COVERAGE_ROW =
  /^ℹ (?<name>[^|]*?) \|(?<line>[\d.]*) \|(?<branch>[\d.]*) \|(?<func>[\d.]*) \|(?<uncov>.*)$/;

/** lineRanges reads `85-87, 120` into the line numbers it names. */
function lineRanges(text: string): Set<number> {
  const out = new Set<number>();
  for (const part of text.replaceAll(",", " ").split(/\s+/)) {
    if (!part) continue;
    const range = /^(\d+)-(\d+)$/.exec(part);
    if (range) for (let n = +range[1]!; n <= +range[2]!; n += 1) out.add(n);
    else if (/^\d+$/.test(part)) out.add(+part);
  }
  return out;
}

/**
 * coverageOf rebuilds the covered files out of one run's report: each path, the lines its run did not reach,
 * and its own line count, so `loaded` and `coveredProdLines` answer the same question they do for every other
 * node row. The percentage is never read as a count — node's denominator is the source file's own lines.
 */
function coverageOf(root: string, report: string): Map<string, number> {
  const lines = report.split("\n");
  const lo = lines.findIndex((l) => l.includes("start of coverage report"));
  const hi = lines.findIndex((l) => l.includes("end of coverage report"));
  if (lo < 0 || hi < 0) throw new Error("the run printed no coverage report");
  const out = new Map<string, number>();
  const stack: string[] = [];
  for (const raw of lines.slice(lo + 1, hi)) {
    const row = COVERAGE_ROW.exec(raw);
    if (!row || /^[ -]*$/.test(row.groups!.name!)) continue;
    const name = row.groups!.name!;
    if (name.trim() === "file" || name.trim() === "all files") continue;
    const depth = name.length - name.replace(/^ /, "").length;
    stack.splice(depth, stack.length, name.trim());
    const full = stack.join("/");
    if (!existsSync(path.join(root, full))) continue;
    const total = readFileSync(path.join(root, full), "utf8").split("\n").length;
    out.set(full, total - lineRanges(row.groups!.uncov!).size);
  }
  return out;
}

/**
 * measureNodeRow runs one node test file alone and fills the columns one run answers — wall time, each
 * case's own duration, the cases and their titles, what it loaded and how much production it covered. The
 * exclusive-line columns are left refused: they need every other file's coverage in the same pass to answer,
 * and that pass is named in the row rather than faked here.
 */
export function measureNodeRow(root: string, file: string, row: Row): Row {
  const started = Date.now();
  let out: string;
  try {
    out = execFileSync("node", [...NODE_MEASURE, file], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 1 << 28,
    });
  } catch (e) {
    // A red run still reports each case it ran; the refusal below says why it is not a measurement.
    out = (e as { stdout?: string }).stdout ?? "";
  }
  const ms = Date.now() - started;
  // The spec reporter repeats a failed case under `failing tests:` after its summary; the
  // run's own list of cases is everything before that, and a case counted twice would
  // count the file's cost twice in the tier budget.
  const report = out.split(/^\u2716 failing tests:$/m)[0]!;
  const cases = report
    .split("\n")
    .map((line) => NODE_TITLE.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ title: m[1]!.trim(), ms: Number(m[2] ?? 0) }));
  if (/^\u2716 /m.test(report))
    throw new Error(`${file}: a case of this file failed, so its durations measure a red run`);
  if (cases.length === 0)
    throw new Error(`${file}: the run reported no case, so its cases are not counted here`);
  const covered = coverageOf(root, out);
  const prodLines = [...covered]
    .filter(([p]) => /^(src|app)\//.test(p))
    .reduce((sum, [, n]) => sum + n, 0);
  return {
    ...row,
    cases: cases.length,
    titles: cases.map((c) => c.title),
    tests: cases.map((c) => ({ title: c.title, ms: c.ms, measured: false })),
    ms,
    testsMs: Math.round(cases.reduce((sum, c) => sum + c.ms, 0) * 10) / 10,
    loaded: covered.size,
    coveredProdLines: prodLines,
    exclusiveNotMeasured:
      "the exclusive-line columns need every other node file's coverage in the same pass; see measured.node",
  };
}

/** measure runs `--measure` for one file and re-renders both artifacts. */
export function measure(root: string, file: string): Row | null {
  const table = readTable(root);
  const row = table.rows.find((r) => r.file === file);
  if (!row) return null;
  if (row.runner !== "node") return null;
  Object.assign(row, measureNodeRow(root, file, row));
  table.totals = totalsOf(table.rows);
  writeFileSync(path.join(root, JSON_PATH), emit(table) + "\n");
  writeFileSync(path.join(root, MD_PATH), renderMarkdown(root, table));
  return row;
}

/** JOBS is what a person does on the phone and which journey names it (0088: one journey per job). */
const JOBS: readonly [string, string, string][] = [
  ["sign in", "e2e/flows/sign-in.yaml", ""],
  [
    "find a resource",
    "e2e/flows/home.yaml, e2e/flows/list.yaml",
    "list.yaml also names the row it created",
  ],
  ["create", "e2e/flows/create.yaml", ""],
  ["read", "e2e/flows/detail.yaml", ""],
  [
    "filter and order",
    "e2e/flows/list.yaml",
    "lines 40-49: Sort / Newest first / Oldest first, then the Filters sheet",
  ],
  ["edit", "e2e/flows/edit.yaml, e2e/flows/record.yaml", "record.yaml:32 taps Edit"],
  ["run a command", "e2e/flows/verb.yaml", ""],
  [
    "delete",
    "e2e/flows/detail.yaml",
    "the header's `…`, the row, then the question carrying the warning",
  ],
  [
    "come back to the app and be where they left off",
    "e2e/flows/session-restored.yaml",
    "signed in, killed, launched again with its state kept: the home screen, never the sign-in form",
  ],
  [
    "recover from an expired session",
    "",
    "**no flow**: the phone's own rule is `src/core/state.ts`'s `expired` transition, entered when the server answers 401 to a session in use, and no step on the device can make the served kernel answer one — `scripts/e2e/mobile_ci.sh` bootstraps one tenant and one administrator and drops both with the run. What exists today is six component tests against `tests/fakes/wire.ts`, where the refusal is written by the test. The journey needs the harness to expire a session, not the flow to pretend to.",
  ],
  [
    "work on a record with a picture",
    "",
    "**no flow**: no route screen draws a record's picture — `grep -il \"picture|photo|image|media\" e2e/flows/*.yaml` is empty and `app/` holds no such screen. `media-hero/*` and `photo-viewer/*` are kit specimens on the gallery route, which is a component's picture, not a record's; the picture a person works on needs a route screen, which is the product's call (and one more `check:flows` claim).",
  ],
];

/** renderMarkdown writes the human table from the same rows the JSON holds. */
export function renderMarkdown(root: string, table: Table): string {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" })
    .trim()
    .slice(0, 9);
  const rows = table.rows;
  const cells = (x: unknown, width?: number): string => {
    let s = x === null || x === undefined ? "" : String(x);
    s = s.replaceAll("|", "/").replaceAll("\n", " ");
    return width !== undefined && s.length > width ? s.slice(0, width - 1) + "…" : s;
  };
  const verdicts = (v: Verdict) => rows.filter((r) => r.verdict === v).length;
  const unreachable = (layer: Layer) => table.totals[layer]?.unreachable ?? 0;
  const md: string[] = [
    "# The test inventory, with the verdict proposed for each test",
    "",
    `Written at \`${head}\` and re-checked on every push by \`npm run check:inventory\` — the shape of every`,
    "row is re-read from the checkout, the numbers stay the record of the run that took them. **Root ratifies",
    "the verdicts in this table before any prune commit lands** (0088). Nothing was deleted to produce it, and",
    "no CI job may read a verdict to decide whether a file runs: a file runs because its runner's glob reaches it.",
    "",
    "## How each column was measured",
    "",
    "| column | command | what the number is |",
    "|---|---|---|",
    "| runner | `node --import tsx --test tests/*.test.ts` / `jest` (the two halves of `npm test`) / `scripts/e2e/run.sh` | which runner executes the file today, read from its own glob |",
    "| wall ms | the same command run for that one file | process wall time, startup included; it decides what a tier costs |",
    "| tests ms | sum of the runner's own per-test durations | the work the file's tests do; this is the column a slowest-tests report reads |",
    "| only-it-covers | `--experimental-test-coverage` per file (node, whose percentage is over the whole source file) / `jest --coverage --coverageReporters=json` per suite (istanbul statement lines) | production lines this file's run covers that no other run of the same runner covers |",
    "| production files only it loads | same | `src/`+`app/` files no other test file of that runner imports at all |",
    "| tests with a line no other test covers | each test run alone: `npx jest <suite> -t '^<fullName>$' --coverage …` and `node --import tsx --test --test-name-pattern='^<fullName>$' --experimental-test-coverage …`, keeping only runs that executed exactly one test | how many of the file's tests cover at least one line no other single test's run covers |",
    "| flaky / reach | the forge's runs of main, or the file's own glob | how many of the last completed runs of main named this file as a failure; `none` means no runner reaches the file, so it can never appear as a failure |",
    "| the rule it proves | the file's own first comment block | 0072 makes a test file state its rules before it imports |",
    "",
    "## The layers, and the tier each runs at here",
    "",
    "| layer | job | tier in this repository (0088 rule 5) | files | cases | work (sum of the runner's own per-test durations) | cost as one process per file | files no runner reaches |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const layer of LAYERS) {
    const t = table.totals[layer];
    md.push(
      `| ${layer} | ${LAYER_JOBS[layer]} | ${LAYER_TIER_TEXT[layer]} | ${t?.files ?? 0} | ${t?.cases ?? 0} | ` +
        `${((t?.testsMs ?? 0) / 1000).toFixed(1)} s | ${((t?.ms ?? 0) / 1000).toFixed(0)} s | ${unreachable(layer)} |`,
    );
  }
  const measured = rows.filter((r) => r.runner === "node" || r.runner === "jest");
  md.push(
    "",
    "## The verdicts",
    "",
    `* keep: ${verdicts("keep")}`,
    `* merge: ${verdicts("merge")}`,
    `* delete: ${verdicts("delete")}`,
    "",
    "The two empty classes are measured, not assumed — see `duplicate-candidates.md` for the eight files a",
    "coverage-and-wording search put forward and why each is a complementary boundary case 0088 keeps.",
    "",
    "Per-test attribution says 92 of the 1101 attributed tests cover a line no other test covers; the rest",
    "share every line they touch with a neighbour. That column is 0088's fourth column, not a merge list:",
    "identical line coverage is not identical assertions, and a merge has to name a successor for each",
    "assertion — which is why a `merge` or `delete` row without a `sibling` and a full `mapping` is refused.",
    "Where a file reads `not measured`, its per-test runs were not finished in the pass that wrote this table",
    "or no runner reaches it (the browser specimens and the flows).",
    "",
    "## The baseline this table records (0088: this repository has no line budget, so counts and coverage per file are the baseline)",
    "",
    `* files inventoried: ${rows.length} — ${rows.filter((r) => r.runner === "node").length} \`tests/*.test.ts\` (node), ` +
      `${rows.filter((r) => r.runner === "jest").length} \`tests/**/*.test.tsx\` (jest), ` +
      `${rows.filter((r) => r.runner === "browser").length} \`.case.mjs\`/\`.spec.ts\`/\`.case.tsx\` reached by no runner, ` +
      `${rows.filter((r) => r.runner === "maestro").length} Maestro flows in \`e2e/flows\``,
    `* cases in files a runner reaches: ${measured.reduce((n, r) => n + (r.cases ?? 0), 0)}; ` +
      `cases in files no runner reaches: ${rows.filter((r) => r.runsNowhere).reduce((n, r) => n + (r.cases ?? 0), 0)}`,
    "* isolated wall time: " +
      LAYERS.map((l) => `${l} ${((table.totals[l]?.ms ?? 0) / 1000).toFixed(0)} s`).join(", "),
    "* the two ratchets: " +
      `review-named files ${table.baseline?.reviewNamed ?? 0} (0072, \`tests/test-name-grammar.test.ts\` refuses a rise), ` +
      `files no runner reaches ${table.baseline?.unreachable ?? 0} (\`check:inventory\` refuses a new one)`,
    "* whole-suite coverage, each with its own denominator: jest `npx jest --coverage --coverageReporters=text-summary` → " +
      "statements 71.51 % (4519/6319), branches 64.51 % (3614/5602), functions 57.6 % (1181/2050), lines 73.57 % " +
      "(4149/5639) in 65.2 s; node `node --import tsx --test --experimental-test-coverage …tests/*.test.ts` → " +
      "91.01 % lines / 89.78 % branch / 62.23 % function over what the node suite loads. **Neither is a budget, and " +
      "they are never added**; the numbers CLEANUP.md:131-152 records are stale and are not the baseline.",
    "* the forge's verdict per workflow, read from the last completed runs of main, is in `inventory.json` under " +
      "`forge` — including that `mobile-e2e.yml` failed every run of main read: its host has no adb, emulator, " +
      "maestro, psql or keytool. Until the runner image changes, no number of flows turns that job green.",
    "",
    "## The jobs a person does on the phone, and the flow that proves each (0088: one journey per job)",
    "",
    "| job | the flow that names it | how it is named |",
    "|---|---|---|",
  );
  for (const [job, flow, how] of JOBS)
    md.push(flow ? `| ${job} | \`${flow}\` | ${how} |` : `| ${job} | — | ${how} |`);
  md.push(
    "",
    "## Which tests the push tier runs",
    "",
    "`npm run check` stays the required check and the merge tier: it runs both suites undiscovered-scoped, and",
    "`tests/component-suite-gate.test.ts` refuses a `check`/`test` script that stops running either. The push",
    "tier runs the contract steps, then the behaviour and composition files whose `loaded` column names a file",
    "the diff touches — `npm run test:push --diff <base>`, which reads this table and prints the files it chose.",
    "It can only ever add work relative to `check`, never replace it: a selection that named no file is a",
    "refusal, and the merge tier runs the whole suite whatever the push tier ran.",
    "",
    "## Rows",
    "",
  );
  for (const layer of LAYERS) {
    md.push(
      `### ${layer}`,
      "",
      "| test file | runner | layer | cases | wall ms | tests ms | only-it-covers (prod lines) | tests with a line no other test covers | production files only it loads | flaky / reach | verdict | the rule it proves |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|",
    );
    for (const r of sortRows(rows)) {
      if (r.layer !== layer) continue;
      const unique =
        typeof r.testsUnique === "number" && typeof r.testsTotal === "number"
          ? `${r.testsUnique} of ${r.testsTotal}`
          : "not measured";
      const flaky = r.runsNowhere
        ? "none"
        : r.runner === "maestro"
          ? "emulator job"
          : String((r.flakyRuns as string[] | undefined)?.length ?? 0);
      md.push(
        "| " +
          [
            cells(r.file),
            cells(r.runner),
            cells(r.layer),
            cells(r.cases),
            cells(r.ms),
            cells(r.testsMs),
            cells(r.onlyProdLines),
            cells(unique, 22),
            cells(((r.onlyFiles as string[] | undefined) ?? []).join(", ") || "—", 60),
            cells(flaky, 13),
            cells(r.verdict),
            cells(r.rule, 160),
          ].join(" | ") +
          " |",
      );
    }
    md.push("");
  }
  return md.join("\n") + "\n";
}

if (process.argv[1]?.endsWith("inventory.ts")) {
  const root = process.cwd();
  const args = process.argv.slice(2);
  if (args[0] === "--sync") {
    const added = sync(root);
    console.log(
      `${JSON_PATH}: ${added.length === 0 ? "every reached file already has a row" : `rows added for ${added.join(", ")}`}`,
    );
  } else if (args[0] === "--measure" && args[1]) {
    const row = measure(root, args[1]);
    if (!row) {
      console.error(
        `${args[1]}: no row to measure (a node row only, and the file has to have a row)`,
      );
      process.exit(1);
    }
    console.log(`${row.file}: ${row.cases} cases, ${row.ms} ms wall, ${row.testsMs} ms of tests`);
  } else {
    const problems = checkInventory(root);
    for (const p of problems) console.error(p);
    if (problems.length === 0) {
      const table = readTable(root);
      console.log(
        `${JSON_PATH}: ${table.rows.length} rows, every reached file answered and every row's shape read from the checkout`,
      );
    }
    process.exit(problems.length === 0 ? 0 : 1);
  }
}
