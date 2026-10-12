// A plan that does not include a feature is not a refusal of what this person just
// did, so the record screen does not say it in the colour of an error. The sentence
// and the colour are one verdict's two answers: both refusals below are drawn through
// the real organism, and the colour is read back off the notice it drew — a rule the
// screen restated in its own JSX would fail here.
import { describe, expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { readFileSync } from "node:fs";
import { deriveCopy, failureSubject } from "../../src/core/derive";
import { parseCatalog } from "../../src/core/catalog";
import { ApiError } from "../../src/effects/api";
import { refusalOf } from "../../src/screens/failure";
import { ResourceDetail } from "../../src/ui/organisms/ResourceDetail";
import { ThemeProvider } from "../../src/ui/theme";
import { palette } from "../../src/ui/tokens";
import { feedback } from "../fakes/presentation";

const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
const note = catalog.resources.find((r) => r.entity === "note")!;
const none = () => undefined;
const copy = deriveCopy("en");

/** The record screen as its composition draws it: one refused read, one notice. */
async function refused(error: unknown) {
  const said = refusalOf(error, "read", failureSubject(note), copy);
  return await render(
    <ThemeProvider mode="light">
      <ResourceDetail
        feedback={feedback}
        entry={note}
        row={undefined}
        error={said.text}
        refusal={said.verdict}
        onRetry={none}
      />
    </ThemeProvider>,
  );
}

describe("the colour a refusal is drawn in", () => {
  test("a plan that excludes the record is a caution", async () => {
    await refused(new ApiError(402, "HTTP 402 crud: plan"));
    expect(screen.getByTestId("refusal")).toHaveStyle({
      backgroundColor: palette.light.statusWarningBg,
    });
  });

  test("a caller who may not read the record is an error", async () => {
    await refused(new ApiError(403, "HTTP 403 crud: forbidden"));
    expect(screen.getByTestId("refusal")).toHaveStyle({
      backgroundColor: palette.light.statusDangerBg,
    });
  });
});
