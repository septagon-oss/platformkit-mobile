// A bar whose chosen destination carries no mark while its neighbours do reads as
// an unfinished row, and it destroys the only treatment that says which
// destination is chosen: a tinted slot, a heavier name, the glyph in the accent.
// Selection is never written by taking a destination's mark away, so every
// destination the gallery's bars name wears the glyph the kit means by its word —
// a calendar for Today, a grid for Sets, a ticket for Passes, a receipt for
// Billing — chosen or not.
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import ionicons from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json";
import { Gallery } from "../../src/ui/gallery";
import { presentation } from "../fakes/presentation";

const marks = new Set(
  Object.values(ionicons as Record<string, number>).map((code) => String.fromCodePoint(code)),
);

type Node = { readonly children: readonly unknown[] };
const strings = (node: Node): string[] =>
  node.children.flatMap((child) => (typeof child === "string" ? [child] : strings(child as Node)));

const wears = (cell: Node) => strings(cell).some((text) => text.length === 1 && marks.has(text));

for (const caseId of ["tab-bar/three", "tab-bar/five", "tab-bar/unavailable"]) {
  test(`every destination of the ${caseId} bar wears a glyph`, async () => {
    await render(<Gallery presentation={presentation} initialCaseId={caseId} />);
    // The lines under the bar name a destination that cannot be opened; they are
    // the explanation, not a cell of the bar.
    const cells = screen
      .getAllByTestId(/^gallery-tabs:/)
      .filter((cell) => !String(cell.props.testID).includes("note-"));
    expect(cells.length).toBeGreaterThan(1);
    expect(cells.filter((cell) => !wears(cell)).map((cell) => cell.props.testID)).toEqual([]);
  });
}

/**
 * The gallery selects the middle destination of its three-tab bar, which is the
 * one cell a reader compares against the two beside it. A measure of the bar that
 * only checked unchosen cells would have let this pass.
 */
test("the destination the bar names chosen keeps the mark its neighbours wear", async () => {
  await render(<Gallery presentation={presentation} initialCaseId="tab-bar/three" />);
  // `tab-bar/three` selects its middle destination (src/core/kitGallery.ts), so
  // this is the cell a reader compares against the two beside it.
  expect(wears(screen.getByTestId("gallery-tabs:passes"))).toBe(true);
});
