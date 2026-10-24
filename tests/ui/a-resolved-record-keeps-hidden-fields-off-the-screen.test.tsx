// The policy's record visibility applies even when the server sends no legacy field hint.
import React from "react";
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { parseCatalog } from "../../src/core/catalog";
import { ResourceDetail } from "../../src/ui/organisms/ResourceDetail";
import { ThemeProvider } from "../../src/ui/theme";
import { invoiceBlock, invoiceDocument } from "../fakes/policy";
import { feedback } from "../fakes/presentation";

test("a record never draws a field the supported policy keeps off records", async () => {
  const block = invoiceBlock();
  block.titles.preview = "";
  block.titles.recordCandidates = ["reference"];
  block.fields[4].onList = false;
  block.fields[4].onRecord = false;
  const document = invoiceDocument(block);
  document.resources[0].fields[4].type = "string";
  const entry = parseCatalog(document).resources[0]!;
  expect(entry.resolved).toBeDefined();
  await render(
    <ThemeProvider mode="light">
      <ResourceDetail
        feedback={feedback}
        entry={entry}
        row={{ id: "invoice-42", reference: "INV-42", memo: "Internal routing note" }}
        error=""
        onRetry={() => undefined}
      />
    </ThemeProvider>,
  );
  expect(screen.getByTestId("resource-detail")).toBeOnTheScreen();
  expect(screen.queryByText("Internal routing note", { includeHiddenElements: true })).toBeNull();
});
