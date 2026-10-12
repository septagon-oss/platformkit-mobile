// A keep reason is what root reads before a prune (0088), so what it points at has to be there to
// read: every tests/ or e2e/ test path a verdictReason names is a row of the table it sits in, and a
// row measured after the table was first written says which run its numbers came from — the one-file
// command the table holds under `measured.commands.<runner>` — rather than that it is new.
// `checkInventory` re-reads a row's own file on every push and refuses an empty reason; the paths and
// pointers inside a reason it never reads, so a renamed sibling or the placeholder `--sync` leaves
// behind would go stale without a refusal. These cases read the same table and refuse both.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

interface Row {
  file: string;
  runner: string;
  ms?: unknown;
  verdictReason: string;
}
interface Table {
  measured: { commands: Record<string, string> };
  rows: Row[];
}

const table = JSON.parse(readFileSync("tests/inventory.json", "utf8")) as Table;
const files = new Set(table.rows.map((r) => r.file));

/** named is every test path a reason spells: a tests/ or e2e/ file with a runner's extension. */
const named = (reason: string): string[] =>
  [
    ...reason.matchAll(
      /((?:tests|e2e)\/[\w./-]+?\.(?:test\.tsx?|case\.mjs|spec\.ts|case\.tsx|ya?ml))/g,
    ),
  ].map((m) => m[1]!);

test("a sibling a keep reason names is a row of this table", () => {
  const stale = table.rows.flatMap((r) =>
    named(r.verdictReason)
      .filter((p) => !files.has(p))
      .map((p) => `${r.file}: its reason names ${p}, which is no row of this table`),
  );
  assert.deepEqual(stale, []);
});

/**
 * measuredAfterwards is the rows whose reasons were written by hand once `--measure` had filled them:
 * the eight files the table took in after it was first measured.
 */
const measuredAfterwards = [
  "tests/a-form-keeps-what-the-person-typed.test.ts",
  "tests/a-whole-row-replace-carries-what-nobody-typed-as-read.test.ts",
  "tests/journey-job-runs-on-the-runner-that-has-a-device.test.ts",
  "tests/screens/a-landed-write-is-heard-where-it-lands.test.tsx",
  "tests/screens/cancel-asks-once.test.tsx",
  "tests/screens/singleton-preserves-hidden-values.test.tsx",
  "tests/screens/useSingleton.test.tsx",
  "tests/ui/refused-field-asks-for-its-box.test.tsx",
];

test("a row measured after the table was written says which run its numbers came from, not that it is new", () => {
  for (const file of measuredAfterwards) {
    const row = table.rows.find((r) => r.file === file);
    assert.ok(row, `${file} has a row`);
    assert.equal(typeof row.ms, "number", `${file} holds a measurement`);
    assert.doesNotMatch(
      row.verdictReason,
      /^new since this table was measured/,
      `${file} still carries the placeholder --sync writes before a measurement`,
    );
    const pointer = `measured.commands.${row.runner}`;
    assert.ok(row.verdictReason.includes(pointer), `${file} says its numbers came from ${pointer}`);
    assert.equal(
      typeof table.measured.commands[row.runner],
      "string",
      `${pointer} is a command the table holds`,
    );
  }
});
