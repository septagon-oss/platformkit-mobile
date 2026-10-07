// A table is what a list cannot be: the same figure in every row sitting in one
// column, under a header that names it. These cases pin where a value goes, that
// an absent figure stays absent instead of becoming a zero, and that a body built
// against a different set of columns refuses rather than drawing a silent gap.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy, deriveTable, type TableInput } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

const currency = { code: "EUR", fractionDigits: 2 };
const input: TableInput = {
  caption: "Open quotes",
  columns: [
    { id: "quote", label: "Quote", kind: "text" },
    { id: "count", label: "Lots", kind: "number" },
    { id: "cost", label: "Price", kind: "money" },
  ],
  rows: [
    {
      id: "q-1",
      cells: [
        { columnId: "quote", value: "North dock" },
        { columnId: "count", value: 12034 },
        { columnId: "cost", value: { minor: "1299", currency } },
      ],
    },
    {
      id: "q-2",
      cells: [
        { columnId: "quote", value: "South dock" },
        { columnId: "count", value: 7 },
        { columnId: "cost", value: { minor: "-157", currency } },
      ],
    },
    {
      id: "q-3",
      cells: [
        { columnId: "quote", value: "East dock" },
        { columnId: "count", value: 40 },
        { columnId: "cost", value: { minor: "900000", currency } },
      ],
    },
  ],
};

const model = <T>(result: { ok: true; value: T } | { ok: false; issues: unknown }): T => {
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value;
};

test("a table names every column and puts every figure under it", () => {
  const value = model(deriveTable(input, presentation));
  assert.deepEqual(
    value.columns.map((c) => [c.label, c.figure]),
    [
      ["Quote", false],
      ["Lots", true],
      ["Price", true],
    ],
  );
  assert.equal(value.rows.length, 3);
  assert.deepEqual(
    value.rows.map((row) => row.cells.map((cell) => [cell.align, cell.text, cell.absent])),
    [
      [
        ["left", "North dock", false],
        ["right", "12,034", false],
        ["right", "EUR\u00a012.99", false],
      ],
      [
        ["left", "South dock", false],
        ["right", "7", false],
        ["right", "-EUR\u00a01.57", false],
      ],
      [
        ["left", "East dock", false],
        ["right", "40", false],
        ["right", "EUR\u00a09,000.00", false],
      ],
    ],
  );
});

test("an absent figure stays absent and is never drawn as a zero", () => {
  const value = model(
    deriveTable(
      {
        ...input,
        rows: [
          {
            id: "q-9",
            cells: [
              { columnId: "quote", value: "Waiting on the yard" },
              { columnId: "count", value: undefined },
              { columnId: "cost", value: undefined },
            ],
          },
        ],
      },
      presentation,
    ),
  );
  assert.deepEqual(
    value.rows[0]!.cells.map((cell) => [cell.text, cell.absent]),
    [
      ["Waiting on the yard", false],
      ["", true],
      ["", true],
    ],
  );
  assert.ok(
    !value.rows[0]!.cells.some((cell) => cell.text === "0" || cell.text === "EUR\u00a00.00"),
  );
});

test("a body built against another set of columns refuses naming what is wrong", () => {
  const refusal =
    (path: string) => (r: { ok: false; issues: readonly { path: string; code: string }[] }) =>
      assert.deepEqual(
        r.issues.filter((i) => i.path === path).map((i) => i.code),
        ["invalid-input"],
        path,
      );
  refusal("columns")(
    deriveTable(
      { ...input, columns: [{ id: "quote", label: "Quote", kind: "text" }] },
      presentation,
    ) as never,
  );
  refusal("columns")(
    deriveTable(
      {
        ...input,
        columns: [...input.columns, { id: "quote", label: "Again", kind: "number" }],
      },
      presentation,
    ) as never,
  );
  refusal("rows")(deriveTable({ ...input, rows: [] }, presentation) as never);
  refusal("rows")(
    deriveTable({ ...input, rows: [input.rows[0]!, input.rows[0]!] }, presentation) as never,
  );
  refusal("rows.0.cells")(
    deriveTable(
      {
        ...input,
        rows: [{ id: "q-1", cells: input.rows[0]!.cells.slice(0, 2) }],
      },
      presentation,
    ) as never,
  );
  refusal("rows.1.cells.cost")(
    deriveTable(
      {
        ...input,
        rows: [
          input.rows[0]!,
          {
            id: "q-2",
            cells: [
              { columnId: "quote", value: "South dock" },
              { columnId: "count", value: 7 },
              { columnId: "cost", value: 12.99 },
            ],
          },
        ],
      },
      presentation,
    ) as never,
  );
});

test("a table reads in the language and place it was asked for", () => {
  for (const [locale, copy, expected] of [
    ["en-GB", deriveCopy("en"), ["12,034", "EUR\u00a012.99"]],
    ["pt-PT", deriveCopy("pt"), ["12\u00a0034", "12,99\u00a0EUR"]],
  ] as const) {
    const value = model(deriveTable(input, { ...presentation, locale, copy: copy as never }));
    assert.deepEqual(
      value.rows[0]!.cells.slice(1).map((cell) => cell.text),
      expected as unknown as string[],
      locale,
    );
  }
});
