// A malformed stored value is rejected before any stroke reaches react-native-svg.
import { expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import React from "react";
import { Value } from "../../src/ui/molecules/Value";
import { ThemeProvider } from "../../src/ui/theme";
import { feedback } from "../fakes/presentation";

interface Node {
  readonly type?: string;
  readonly children?: readonly (Node | string)[];
}

function types(node: Node | string | null | undefined, found: string[] = []): string[] {
  if (!node || typeof node === "string") return found;
  if (node.type) found.push(node.type);
  for (const child of node.children ?? []) types(child, found);
  return found;
}

test("a malformed stored sketch is refused as a whole before it reaches the canvas", async () => {
  const { toJSON } = await render(
    <ThemeProvider mode="light">
      <Value
        presentation={feedback}
        field={{ name: "drawing", type: "sketch" }}
        value={[[[10, 20, 0]], [], [[30, 40, 0]]]}
      />
    </ThemeProvider>,
  );

  expect(types(toJSON() as Node | null)).not.toContain("RNSVGPath");
  expect(types(toJSON() as Node | null)).not.toContain("RNSVGCircle");
});
