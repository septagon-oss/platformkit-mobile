// table.ts is the one reading of a set of records that a list cannot give: a
// fixed column of figures beside a fixed column of names, so the amount in the
// fourth row sits under the amount in the first. A row list puts its cells
// wherever the longest word in front of them ends, which is why two rows of a
// watchlist shared no baseline. Money stays in minor units with its Currency and
// is formatted by the same moneyText every price uses; a figure that is absent
// stays absent rather than becoming a zero, which is a different claim.
import { money, moneyText, type Money } from "./commerce";
import type { Presentation } from "./presentation";
import { build, type Validation } from "./shared";

export type CellKind = "text" | "number" | "money";

export interface TableColumn {
  readonly id: string;
  readonly label: string;
  /** kind says what the column holds, which is what decides its edge. */
  readonly kind: CellKind;
}

export interface TableCell {
  readonly columnId: string;
  /**
   * A cell with no value — the key absent or the value undefined — says the
   * record has no figure. It is not a zero, and a caller may say it either way.
   */
  readonly value?: string | number | Money | undefined;
}

export interface TableRow {
  readonly id: string;
  readonly cells: readonly TableCell[];
}

export interface TableInput {
  readonly caption: string;
  readonly columns: readonly TableColumn[];
  readonly rows: readonly TableRow[];
}

const KINDS: readonly CellKind[] = ["text", "number", "money"];

/** A figure takes the column's right edge so its last digit lines up; words take the left. */
const isFigure = (kind: CellKind): boolean => kind === "number" || kind === "money";

function numberText(value: number, p: Presentation): string {
  if (!Number.isFinite(value)) throw new RangeError("unrenderable-figure");
  return new Intl.NumberFormat(p.locale, { maximumSignificantDigits: 21 }).format(value);
}

export function deriveTable(input: TableInput, p: Presentation) {
  return build(p, (v: Validation) => {
    v.text(input.caption, "caption");
    v.need(input.columns.length >= 2, "columns");
    const ids = new Set(input.columns.map((c) => c.id));
    v.need(ids.size === input.columns.length, "columns");
    for (const [i, column] of input.columns.entries()) {
      v.text(column.label, `columns.${i}.label`);
      v.need(KINDS.includes(column.kind), `columns.${i}.kind`);
    }
    // A table with no rows is a header: what a person came to read is missing,
    // so the caller sends its empty state instead of a table with no body.
    v.need(input.rows.length > 0, "rows");
    const rowIds = new Set(input.rows.map((r) => r.id));
    v.need(rowIds.size === input.rows.length, "rows");
    const rows = input.rows.map((row, i) => {
      const seen = new Set<string>();
      return {
        id: row.id,
        cells: input.columns.map((column) => {
          const cell = row.cells.find((c) => c.columnId === column.id);
          v.need(cell !== undefined, `rows.${i}.cells`);
          v.need(!seen.has(column.id), `rows.${i}.cells.${column.id}`);
          seen.add(column.id);
          const absent = cell!.value === undefined || cell!.value === null;
          let text = "";
          if (!absent) {
            const value = cell!.value!;
            if (column.kind === "money") {
              // The same money rule a price obeys: minor units, a Currency, a range.
              const amount =
                typeof value === "object" ? money(value, v, `rows.${i}.cells.${column.id}`) : null;
              v.need(amount !== null, `rows.${i}.cells.${column.id}`);
              text = amount === null ? "" : moneyText(value as Money, p);
            } else if (column.kind === "number") {
              v.need(typeof value === "number", `rows.${i}.cells.${column.id}`);
              text = typeof value === "number" ? numberText(value, p) : "";
            } else {
              v.need(typeof value === "string", `rows.${i}.cells.${column.id}`);
              text = typeof value === "string" ? value : "";
              v.text(text, `rows.${i}.cells.${column.id}`);
            }
          }
          return {
            columnId: column.id,
            text,
            absent,
            align: isFigure(column.kind) ? ("right" as const) : ("left" as const),
          };
        }),
      };
    });
    return {
      caption: input.caption,
      columns: input.columns.map((c) => ({
        id: c.id,
        label: c.label,
        figure: isFigure(c.kind),
      })),
      rows,
      testID: "kit-table",
    };
  });
}

export type TableModel = Extract<ReturnType<typeof deriveTable>, { ok: true }>["value"];
