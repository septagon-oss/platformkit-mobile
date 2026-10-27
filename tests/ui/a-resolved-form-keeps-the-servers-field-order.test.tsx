// The form organism keeps the policy's create order through the production grouping adapter.
import React from "react";
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { parseCatalog } from "../../src/core/catalog";
import { formSections } from "../../src/core/derive";
import { ResourceForm } from "../../src/ui/organisms/ResourceForm";
import { ThemeProvider } from "../../src/ui/theme";
import { invoiceDocument } from "../fakes/policy";
import { feedback } from "../fakes/presentation";

test("a resolved create form draws its fields in the order the server named", async () => {
  const entry = parseCatalog(invoiceDocument()).resources[0]!;
  const blocks = formSections(entry, undefined, true, feedback.copy.kit.overview);
  await render(
    <ThemeProvider mode="light">
      <ResourceForm
        feedback={feedback}
        initialDate={new Date("2026-07-18T09:00:00Z")}
        blocks={blocks}
        held={{}}
        errors={{}}
        detail=""
        phase="editing"
        onChange={() => undefined}
        onRetry={() => undefined}
      />
    </ThemeProvider>,
  );
  const drawn = screen.getAllByTestId(/^field-/);
  expect(drawn.map((node) => node.props.testID)).toEqual([
    "field-status",
    "field-reference",
    "field-total",
  ]);
});
