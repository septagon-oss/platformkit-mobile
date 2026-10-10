// The `…` sits in the native header, which stays put while the record scrolls, so what
// it opens appears where the person was looking: the open menu is the first row of the
// record, above every field row and above the collapsed Record information — never at
// the foot of a scroll view a person has to hunt down. README "How a record opens"
// states the place ("opened inline under the header"), and this test is that sentence
// read off the rendered tree.
import { feedback, presentation } from "../fakes/presentation";
import { expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import { deriveDisclosure } from "../../src/core/derive";
import { ResourceDetail } from "../../src/ui/organisms/ResourceDetail";
import { ThemeProvider } from "../../src/ui/theme";

const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
const note = catalog.resources.find((r) => r.entity === "note")!;
const none = () => undefined;
const row = { id: "1", title: "Buy milk", status: "open", rank: 2, pinned: true, tags: ["a"] };

/**
 * whereIs is the place an id holds in what the screen drew: the position its testID
 * first appears at in the rendered tree, which is the order a person scrolls past.
 */
function whereIs(id: string): number {
  const at = JSON.stringify(screen.toJSON()).indexOf(`"testID":"${id}"`);
  expect(at).toBeGreaterThanOrEqual(0);
  return at;
}

const information = {
  model: (() => {
    const model = deriveDisclosure(
      {
        id: "record-information",
        title: feedback.copy.kit.recordInformation,
        summary: feedback.copy.kit.recordInformationHolds,
        reveals: feedback.copy.kit.recordInformationContent,
        expanded: true,
        depth: 1,
        enabled: true,
      },
      presentation,
    );
    if (!model.ok) throw new Error(JSON.stringify(model.issues));
    return model.value;
  })(),
  onExpanded: none,
};

test("the row the header's `…` opens is drawn above the record it is about", async () => {
  await render(
    <ThemeProvider mode="light">
      <ResourceDetail
        feedback={feedback}
        entry={note}
        row={row}
        error=""
        onRetry={none}
        information={information}
        onDelete={jest.fn()}
        menuOpen
      />
    </ThemeProvider>,
  );
  const menu = whereIs("delete");
  // Every row of the record — the overview's fields and the collapsed plumbing — is
  // below the menu the header opened, so the answer is on screen the moment it is.
  for (const below of ["field-status", "field-rank", "field-pinned", "field-tags"]) {
    expect(menu).toBeLessThan(whereIs(below));
  }
  expect(menu).toBeLessThan(whereIs("record-information"));
  await screen.unmount();
});
