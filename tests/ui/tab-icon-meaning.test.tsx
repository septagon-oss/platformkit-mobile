// A tab's icon says the same thing as its label. The gallery's tab bars draw a
// Search destination; whatever glyph sits over the word "Search" must be the
// magnifier the kit's Icon calls `search`, not whichever glyph happened to be
// next in a list that does not know which tab it is drawn for.
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import ionicons from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json";
import { Gallery } from "../../src/ui/gallery";
import { presentation } from "../fakes/presentation";

const glyph = (name: string) => String.fromCodePoint((ionicons as Record<string, number>)[name]!);

for (const caseId of ["tab-bar/three", "tab-bar/five"]) {
  test(`the ${caseId} search destination wears the search glyph`, async () => {
    await render(<Gallery presentation={presentation} initialCaseId={caseId} />);
    const search = screen.getByTestId("gallery-tabs:search");
    type Node = { readonly children: readonly unknown[] };
    const strings = (node: Node): string[] =>
      node.children.flatMap((child) =>
        typeof child === "string" ? [child] : strings(child as Node),
      );
    expect(strings(search)).toContain(glyph("search"));
  });
}
