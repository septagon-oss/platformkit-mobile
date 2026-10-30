// A stored sketch with decreasing elapsed time is refused before any stroke is drawn.
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

test("a sketch with decreasing elapsed time draws no partial stroke", async () => {
  const { toJSON } = await render(
    <ThemeProvider mode="light">
      <Value
        presentation={feedback}
        field={{ name: "drawing", type: "sketch" }}
        value={[
          [
            [10, 20, 0],
            [30, 40, 9],
            [50, 60, 8],
          ],
        ]}
      />
    </ThemeProvider>,
  );

  const drawnTypes = types(toJSON() as Node | null);
  expect(drawnTypes).not.toContain("RNSVGPath");
  expect(drawnTypes).not.toContain("RNSVGCircle");
});
