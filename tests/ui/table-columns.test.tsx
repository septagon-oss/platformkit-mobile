// What a person sees when the kit draws a table: every column named above its
// values, one row per record read aloud as one element, and a figure that is
// missing drawn as nothing rather than as zero.
import React from "react";
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { deriveTable, type Result, type TableInput } from "../../src/core/derive";
import { DataTable } from "../../src/ui/organisms/DataTable";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const currency = { code: "USD", fractionDigits: 2 };

const value = <T,>(result: Result<T>): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

const input: TableInput = {
  caption: "Open quotes",
  columns: [
    { id: "line", label: "Line", kind: "text" },
    { id: "lots", label: "Lots", kind: "number" },
    { id: "cost", label: "Cost", kind: "money" },
  ],
  rows: [
    {
      id: "haulage",
      cells: [
        { columnId: "line", value: "Haulage" },
        { columnId: "lots", value: 3 },
        { columnId: "cost", value: { minor: "2450", currency } },
      ],
    },
    {
      id: "storage",
      cells: [
        { columnId: "line", value: "Storage" },
        { columnId: "lots", value: 18 },
        // No cost yet: the row says so without claiming a free line.
        { columnId: "cost" },
      ],
    },
  ],
};

const drawn = () =>
  render(
    <ThemeProvider>
      <DataTable model={value(deriveTable(input, presentation))} />
    </ThemeProvider>,
  );

test("a table names each column once and keeps its values under it", async () => {
  await drawn();
  for (const label of ["Line", "Lots", "Cost"]) expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getByText("Haulage")).toBeTruthy();
  expect(screen.getByText("18")).toBeTruthy();
  expect(screen.getByText("USD\u00a024.50")).toBeTruthy();
  expect(screen.getByTestId("kit-table-row-haulage")).toBeTruthy();
  expect(screen.getByTestId("kit-table-row-storage")).toBeTruthy();
});

test("a row reads as one element that says its columns and its values", async () => {
  await drawn();
  expect(screen.getByTestId("kit-table-row-haulage").props.accessibilityLabel).toBe(
    "Line: Haulage, Lots: 3, Cost: USD\u00a024.50",
  );
  // The missing cost is a dash and never a zero, so the row's sentence says so.
  expect(screen.getByTestId("kit-table-row-storage").props.accessibilityLabel).toBe(
    "Line: Storage, Lots: 18, Cost: —",
  );
  expect(screen.queryByText("USD\u00a00.00")).toBeNull();
});
