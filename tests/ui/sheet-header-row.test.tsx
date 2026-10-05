// A sheet that opens with a full-width Close band tells the person to leave before
// it has shown them what it holds. Its header is one row: the title takes the column
// and the way out sits at the edge the title ends at.
import React from "react";
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { kitExamples, type Result } from "../../src/core/derive";
import { DetailSheet } from "../../src/ui/templates/DetailSheet";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const ok = <T,>(result: Result<T>): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

test("a sheet's title leads its header and its close control stands beside it", async () => {
  const model = ok(kitExamples(presentation, "detail-sheet/open")).surface;
  await render(
    <ThemeProvider mode="light">
      <DetailSheet model={model} onRequestClose={() => {}}>
        <Text>Admission</Text>
      </DetailSheet>
    </ThemeProvider>,
  );
  const title = screen.getByRole("header", { name: model.title });
  const close = screen.getByRole("button", { name: model.close.label });
  // The title owns the column and the control shares its row: the row is the
  // title's own container's parent, and it is laid out across, not down.
  const row = title.parent?.parent ?? null;
  expect(row).not.toBeNull();
  expect(row).toBe(close.parent);
  expect(row).toHaveStyle({ flexDirection: "row" });
  expect(close.parent).not.toBe(title.parent);
  expect(screen.getByText("Admission")).toBeTruthy();
});
