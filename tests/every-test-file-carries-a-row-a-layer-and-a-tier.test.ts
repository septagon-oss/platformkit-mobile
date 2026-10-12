// The suite is only evidence if a reader can find out what it holds. Three rules keep tests/inventory.json
// answering that question: every file a runner reaches has exactly one row, and the row's layer, tier, reach
// and rule are read back out of the file rather than remembered; a `merge` or `delete` verdict names the
// sibling that keeps its rule and maps every one of its assertions to the test that keeps it, because
// identical line coverage is not identical assertions; and the count of files no runner reaches may not rise,
// so a test added to this repository cannot be filed where nothing runs it. The fourth rule is where each
// layer then runs: the push tier's scope is the transitive import closure of the diff, the merge tier is
// `npm run check` whole, and the nightly tier publishes what the suite cost. The fifth rule is that every
// measured number came from a run: a measurement reads the columns its runner prints, refuses a report it
// read no counts from and a run in which a case failed, and keeps the per-test record one run cannot take.
// The sixth is that the table is written in one order, so regenerating over an unchanged checkout is the
// identity.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  checkInventory,
  coverageOf,
  jestRow,
  measureNodeRow,
  TIERS,
  totalsOf,
  sortRows,
  type Row,
} from "../scripts/inventory";
import { reachedBy, suiteFiles } from "../scripts/tiers";

const RULE = "one rule of one unit, named before it imports";

/** row is the smallest shape a checked row takes: its shape, and a measurement it is honest about holding. */
function row(file: string, over: Partial<Row> = {}): Row {
  const runner =
    /\.tsx?$/.test(file) && file.endsWith(".tsx")
      ? "jest"
      : /\.ya?ml$/.test(file)
        ? "maestro"
        : file.endsWith(".case.mjs")
          ? "browser"
          : "node";
  const layer = (over.layer ?? "behaviour") as Row["layer"];
  return {
    file,
    runner,
    layer,
    cases: 1,
    ms: 100,
    testsMs: 1.5,
    loaded: 2,
    coveredProdLines: 10,
    onlyProdLines: 0,
    onlyFiles: [],
    onlyLines: [],
    flakyRuns: [],
    titles: ["the unit answers the case"],
    tests: [{ title: "the unit answers the case", ms: 1.5, measured: false }],
    rule: RULE,
    ruleSource: "first comment",
    verdict: "keep",
    verdictReason: "the only row whose subject is the rule above",
    tier: TIERS[layer],
    reach: `npm test (${runner} half)`,
    runsNowhere: false,
    ...over,
  };
}

/**
 * tree is a checkout small enough to read at once: a reached test file, a component suite, a flow, and the
 * table that answers for them. A caller breaks one thing at a time and asks what the gate refuses.
 */
function tree(t: TestContext, files: Record<string, string>, rows: Row[]): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-inventory-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (at: string, text: string) => {
    const file = path.join(root, at);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  write("tests/inventory.json", `${JSON.stringify(table(rows), null, 1)}\n`);
  for (const [at, text] of Object.entries(files)) write(at, text);
  return root;
}

const table = (rows: Row[]) => ({
  schema: 1,
  unit: "one row per test file",
  measured: { commands: { node: "node --import tsx --test <file>" } },
  forge: {},
  baseline: { reviewNamed: 0, unreachable: 0 },
  totals: totalsOf(sortRows(rows)),
  rows,
});

const SUITE = `// ${RULE}\nimport test from "node:test";\ntest("the unit answers the case", () => {});\n`;
const FLOW = `# ${RULE}\n# screen: app/index.tsx\nappId: \${APP_ID}\n---\n- launchApp\n`;

test("a checkout answers its own inventory table", () => {
  assert.deepEqual(checkInventory(process.cwd()), []);
});

test("a test file the table does not answer for is refused", (t) => {
  const root = tree(t, { "tests/keeps.test.ts": SUITE, "tests/added.test.ts": SUITE }, [
    row("tests/keeps.test.ts"),
  ]);
  assert.deepEqual(checkInventory(root), [
    "tests/added.test.ts: no row — a test file the table does not answer for is a test nobody inventoried",
  ]);
});

test("a row whose file is gone is refused, not quietly dropped", (t) => {
  const root = tree(t, { "tests/keeps.test.ts": SUITE }, [
    row("tests/deleted.test.ts"),
    row("tests/keeps.test.ts"),
  ]);
  assert.deepEqual(checkInventory(root), [
    "tests/deleted.test.ts: the row names a file this checkout does not hold",
  ]);
});

test("a layer a file does not answer to is refused unless its row says why", (t) => {
  // The file mounts the shell, so what it proves is composition; the row calls it behaviour.
  const mounts = `// ${RULE}\nimport { Shell } from "../src/shell";\nexport default () => Shell(null);\n`;
  const asBehavour = row("tests/mounts.test.tsx", { runner: "jest" });
  const root = tree(t, { "tests/mounts.test.tsx": mounts }, [asBehavour]);
  assert.deepEqual(checkInventory(root), [
    "tests/mounts.test.tsx: row says behaviour, what it imports and reads answers composition (override with a layerReason)",
  ]);
  const rewritten = tree(t, { "tests/mounts.test.tsx": mounts }, [
    row("tests/mounts.test.tsx", {
      runner: "jest",
      layer: "composition",
      reach: "npm test (jest half)",
      layerReason: "its subject is the mounted shell, whatever the folder it sits in says",
    }),
  ]);
  assert.deepEqual(checkInventory(rewritten), []);
});

test("a verdict that removes a test names its successor and maps every assertion", (t) => {
  const root = tree(t, { "tests/keeps.test.ts": SUITE, "tests/duplicate.test.ts": SUITE }, [
    row("tests/keeps.test.ts"),
    row("tests/duplicate.test.ts", {
      verdict: "delete",
      verdictReason: "the same assertions as tests/keeps.test.ts",
    }),
  ]);
  assert.deepEqual(
    checkInventory(root).filter((p) => p.startsWith("tests/duplicate.test.ts")),
    [
      "tests/duplicate.test.ts: a delete verdict names no sibling that keeps its rule",
      "tests/duplicate.test.ts: a delete verdict carries no assertion-to-successor mapping (0088)",
    ],
  );
  // The mapping has to reach every assertion, not only the one that came to mind first.
  const halfMapped = tree(t, { "tests/keeps.test.ts": SUITE }, [
    row("tests/keeps.test.ts"),
    row("tests/keeps.test.ts", {
      file: "tests/duplicate.test.ts",
      verdict: "merge",
      sibling: "tests/keeps.test.ts",
      titles: ["the unit answers the case", "and its boundary"],
      tests: [
        { title: "the unit answers the case", ms: 1.5, measured: false },
        { title: "and its boundary", ms: 1.5, measured: false },
      ],
      mapping: { "the unit answers the case": "tests/keeps.test.ts: the unit answers the case" },
    }),
  ]);
  assert.ok(
    checkInventory(halfMapped).some((p) =>
      p.includes('nothing keeps the assertion "and its boundary"'),
    ),
    `unmapped assertions are refused: ${checkInventory(halfMapped).join("; ")}`,
  );
});

test("a file added where nothing runs it is refused by name", (t) => {
  // A browser specimen matches no runner's glob, so it joins the count 0088 keeps as a ratchet.
  const root = tree(t, { "tests/keeps.test.ts": SUITE, "tests/unreached.case.mjs": SUITE }, [
    row("tests/keeps.test.ts"),
    row("tests/unreached.case.mjs", {
      runner: "browser",
      layer: "journey",
      needsEnv: [],
      reach:
        "no runner: needs REVIEW_GALLERY_URL + PLAYWRIGHT_MODULE (Playwright is not a dependency)",
      runsNowhere: true,
    }),
  ]);
  assert.deepEqual(checkInventory(root), [
    "1 files match no runner, the baseline is 0: a file added to the suite has to be reached by a tier, not filed (0088 rule 5)",
  ]);
});

test("a flow's row answers the journey in the file, at either spelling", (t) => {
  const root = tree(t, { "e2e/flows/index.yaml": FLOW }, [
    row("e2e/flows/index.yaml", {
      runner: "maestro",
      layer: "journey",
      reach:
        "emulator job only (mobile-e2e.yml): every run of main read from the forge failed there",
      claims: ["app/index.tsx"],
      steps: 1,
    }),
  ]);
  assert.deepEqual(checkInventory(root), []);
});

test("a row that no longer quotes the file's own rule is refused", (t) => {
  const root = tree(t, { "tests/keeps.test.ts": SUITE }, [
    row("tests/keeps.test.ts", { rule: "something else" }),
  ]);
  assert.deepEqual(checkInventory(root), [
    "tests/keeps.test.ts: the rule its row quotes is no longer the comment at the top of the file",
  ]);
});

test("the totals a person reads are the rows they were drawn from", (t) => {
  const rows = [row("tests/keeps.test.ts")];
  const root = tree(t, { "tests/keeps.test.ts": SUITE }, rows);
  const written = JSON.parse(readFileSync(path.join(root, "tests/inventory.json"), "utf8")) as {
    totals: Record<string, { cases?: number } | undefined>;
  };
  assert.equal(written.totals.behaviour?.cases, 1);
  writeFileSync(
    path.join(root, "tests/inventory.json"),
    JSON.stringify({ ...table(rows), totals: { behaviour: { cases: 99 } } }, null, 1),
  );
  assert.ok(
    checkInventory(root).some((p) => p.startsWith("tests/inventory.json: totals.behaviour")),
    "a quoted figure the rows no longer answer is refused",
  );
});

const scratch = (t: TestContext): string => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-tiers-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (at: string, text: string) => {
    const file = path.join(root, at);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  // One molecule, the organism that mounts it, the suite that renders the organism, a suite beside it that
  // reaches neither, and a Node test over a derivation: a change to the molecule has to reach the organism's
  // suite and nobody else's.
  write("src/ui/molecules/Chip.tsx", "export const Chip = () => null;\n");
  write(
    "src/ui/organisms/Row.tsx",
    'import { Chip } from "../molecules/Chip";\nexport const Row = () => Chip();\n',
  );
  write(
    "tests/ui/row.test.tsx",
    'import { Row } from "../../src/ui/organisms/Row";\ntest("row", () => {});\n',
  );
  write("tests/ui/other.test.tsx", 'test("other", () => {});\n');
  write(
    "tests/derive.test.ts",
    'import { reduce } from "../src/core/state";\ntest("derive", () => {});\n',
  );
  write("src/core/state.ts", "export const reduce = 0;\n");
  return root;
};

test("the push tier reaches the suites that import a changed file, whoever they import it through", (t) => {
  const root = scratch(t);
  assert.deepEqual(suiteFiles(root), {
    node: ["tests/derive.test.ts"],
    jest: ["tests/ui/other.test.tsx", "tests/ui/row.test.tsx"],
  });
  assert.deepEqual(reachedBy(root, ["src/ui/molecules/Chip.tsx"]), {
    node: [],
    jest: ["tests/ui/row.test.tsx"],
    untested: [],
  });
  assert.deepEqual(reachedBy(root, ["src/core/state.ts", "README.md", "testdata/catalog.json"]), {
    node: ["tests/derive.test.ts"],
    jest: [],
    untested: [],
  });
  // A production file no suite imports is named: that is the hole the push tier exists to show.
  assert.deepEqual(reachedBy(root, ["src/core/unused.ts"]), {
    node: [],
    jest: [],
    untested: ["src/core/unused.ts"],
  });
});

test("the tiers are wired where they run and the merge tier is the required check", () => {
  const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts as Record<
    string,
    string
  >;
  const contracts = scripts["test:contracts"] ?? "";
  for (const step of [
    "check:api",
    "check:sdk",
    "check:source",
    "check:publish",
    "check:fingerprint",
    "check:flows",
    "check:inventory",
  ])
    assert.ok(contracts.includes(`npm run ${step}`), `the contract tier runs ${step}`);
  // The push tier may only ever add work relative to the required check: `check` still runs the whole suite,
  // it now runs the inventory re-check too, and the merge tier is `check` by name.
  assert.match(scripts.check ?? "", /npm run check:inventory/);
  assert.equal(scripts["test:merge"], "npm run check");
  const ci = readFileSync(".gitea/workflows/ci.yml", "utf8");
  assert.match(ci, /npm run test:contracts/, "the contract tier is the first thing a push answers");
  assert.match(
    ci,
    /npm run test:scope/,
    "the push tier names the behaviour files the diff reaches",
  );
  assert.match(
    ci,
    /run: npm run check/,
    "the whole suite still runs on every push and every pull request",
  );
  const nightly = readFileSync(".gitea/workflows/nightly.yml", "utf8");
  assert.match(nightly, /npm run report:tests/, "the nightly publishes what the suite costs");
});

/**
 * measureRoot is a checkout a measurement can run in: the loader `npm test` uses, reached by symlink rather
 * than by a second install, and one derivation with a test over it, so the run has a production file to load.
 */
const measureRoot = (t: TestContext): string => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-measure-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (at: string, text: string) => {
    const file = path.join(root, at);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  symlinkSync(path.resolve("node_modules"), path.join(root, "node_modules"), "dir");
  write("src/core/state.ts", "export const reduce = 0;\nexport const step = 1;\n");
  write(
    "tests/derive.test.ts",
    `// ${RULE}\nimport test from "node:test";\nimport { reduce, step } from "../src/core/state";\n` +
      `test("the unit answers the case", () => { if (reduce + step !== 1) throw new Error("sum"); });\n` +
      `test("the derivation is read twice", () => { if (step * 2 !== 2) throw new Error("twice"); });\n`,
  );
  return root;
};

test("a measurement reads the coverage columns the runner right-aligns, and refuses a report it read nothing from", (t) => {
  const root = measureRoot(t);
  const measured = measureNodeRow(root, "tests/derive.test.ts", row("tests/derive.test.ts"));
  assert.equal(measured.cases, 2);
  // The report prints ` inventory.ts |  62.34 |    79.00 |` — a number padded to its column. A parse that
  // asked for one space after the pipe matched none of them and wrote `loaded: 0` for a file that loaded one.
  assert.equal(measured.loaded, 1, "the one production file the run loaded is counted");
  assert.ok((measured.coveredProdLines as number) > 0, "a loaded file covers lines");
  const block = (rows: string[]) =>
    [
      "ℹ start of coverage report",
      "ℹ file      | line % | branch % | funcs % | uncovered lines",
      ...rows,
      "ℹ all files | 100.00 |   100.00 |  100.00 | ",
      "ℹ end of coverage report",
    ].join("\n");
  // A run that loaded nothing prints no file row at all: that answer is `loaded: 0`, not a refusal.
  assert.equal(coverageOf(root, block([])).size, 0);
  // A run that printed a row this unit read no counts from is a broken parse, not an empty measurement.
  assert.throws(
    () =>
      coverageOf(
        root,
        block([
          "ℹ  gone.ts     |  62.34 |    79.00 |   63.79 | 1-2",
          "ℹ src          |        |          |         | ",
        ]),
      ),
    /read no counts from/,
  );
});

test("a component suite is measured by its own runner, and an exclusive run survives the measurement", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-jest-row-"));
  const at = (f: string) => path.join(root, f);
  const held = row("tests/ui/chosen.test.tsx", {
    runner: "jest",
    tests: [
      { title: "the chip stands chosen", ms: 9, measured: true, isolatedMs: 40, onlyProdLines: 3 },
      { title: "the chip leaves chosen", ms: 9, measured: true, isolatedMs: 41, onlyProdLines: 0 },
    ],
  });
  const suite = jestRow(
    root,
    "tests/ui/chosen.test.tsx",
    held,
    {
      success: true,
      testResults: [
        {
          assertionResults: [
            { title: "  the chip stands chosen  ", status: "passed", duration: 12 },
            { title: "the chip leaves chosen", status: "passed", duration: 0.5 },
          ],
        },
      ],
    },
    {
      [at("src/ui/atoms/Chip.tsx")]: { path: at("src/ui/atoms/Chip.tsx"), s: { 0: 1, 1: 0, 2: 4 } },
      [at("tests/fakes/wire.ts")]: { path: at("tests/fakes/wire.ts"), s: { 0: 7 } },
    },
    1234,
  );
  assert.equal(suite.cases, 2);
  assert.deepEqual(suite.titles, ["the chip stands chosen", "the chip leaves chosen"]);
  assert.equal(suite.ms, 1234);
  assert.equal(suite.testsMs, 12.5);
  assert.equal(suite.loaded, 2, "both files the run instrumented are counted");
  assert.equal(suite.coveredProdLines, 2, "only the src/ file's statements reached at least once");
  const carried = (suite.tests as Record<string, unknown>[])[0]!;
  assert.equal(carried.isolatedMs, 40, "a per-test exclusive run is the record of its own pass");
  assert.equal(carried.measured, false, "and this run says plainly it was not that pass");
  // A red run measures nothing, and a run that named no case is not a measurement either.
  assert.throws(
    () => jestRow(root, "tests/ui/chosen.test.tsx", held, { success: false }, {}, 1),
    /measure a red run/,
  );
  assert.throws(
    () =>
      jestRow(root, "tests/ui/chosen.test.tsx", held, { success: true, testResults: [] }, {}, 1),
    /reported no case/,
  );
});

test("a file named like a test where no runner looks is discovered, and a row for it is refused", (t) => {
  // node's glob is one folder deep and jest takes .test.tsx: a `.test.ts` under tests/ui/ runs nowhere, and
  // 0088 keeps that as a count the table may not let rise rather than a file nobody looks at.
  const files = { "tests/keeps.test.ts": SUITE, "tests/ui/misplaced.test.ts": SUITE };
  const unfiled = tree(t, files, [row("tests/keeps.test.ts")]);
  assert.deepEqual(checkInventory(unfiled), [
    "tests/ui/misplaced.test.ts: no row — a test file the table does not answer for is a test nobody inventoried",
  ]);
  const filed = tree(t, files, [
    row("tests/ui/misplaced.test.ts", {
      runner: "browser",
      needsEnv: [],
      reach:
        "no runner: node's glob is tests/*.test.ts and jest's testMatch is tests/**/*.test.tsx, so a file named like a test in a subfolder of tests/ is reached by neither",
      runsNowhere: true,
    }),
    row("tests/keeps.test.ts"),
  ]);
  assert.deepEqual(checkInventory(filed), [
    "1 files match no runner, the baseline is 0: a file added to the suite has to be reached by a tier, not filed (0088 rule 5)",
  ]);
});

test("the table is written in one order, so regenerating over an unchanged checkout moves nothing", (t) => {
  const rows = [row("tests/b.test.ts"), row("tests/a.test.ts")];
  const root = tree(t, { "tests/a.test.ts": SUITE, "tests/b.test.ts": SUITE }, rows);
  assert.deepEqual(
    sortRows(rows).map((r) => r.file),
    ["tests/a.test.ts", "tests/b.test.ts"],
    "one order: layer, then runner, then file",
  );
  assert.deepEqual(checkInventory(root), [
    "tests/inventory.json: rows are not in the order --sync writes them — tests/b.test.ts belongs at tests/a.test.ts",
  ]);
});
