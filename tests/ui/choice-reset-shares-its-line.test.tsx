// A reset is a word about the choice it clears. Given its own full-width row it joins
// the column of actions below the chips, where a person scanning for the next thing to
// do reads it as one of them — which is what a capture of the home page named.
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { deriveChoices, type Result } from "../../src/core/derive";
import { ChoiceChips } from "../../src/ui/molecules/ChoiceChips";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const ok = <T,>(result: Result<T>): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

interface Node {
  readonly type?: string;
  readonly props?: Record<string, unknown>;
  readonly children?: readonly (Node | string)[];
}

/** The path from the drawn root to the node that carries the given text, root first. */
function pathTo(node: Node, needle: string, trail: readonly Node[] = []): readonly Node[] {
  const here = [...trail, node];
  if (node.children?.some((child) => typeof child === "string" && child.includes(needle))) {
    return here;
  }
  for (const child of node.children ?? []) {
    if (typeof child === "string") continue;
    const found = pathTo(child, needle, here);
    if (found.length) return found;
  }
  return [];
}

const rowStyle = (node: Node): boolean => {
  const style = node.props?.style as Record<string, unknown> | readonly object[] | undefined;
  const flat = Array.isArray(style) ? Object.assign({}, ...style) : (style ?? {});
  return flat.flexDirection === "row";
};

test("the reset sits on the line of the choice it belongs to", async () => {
  const model = ok(
    deriveChoices(
      {
        id: "option",
        label: "Pass option",
        choices: [
          { id: "first", label: "Individual", enabled: true },
          { id: "second", label: "Two adults", enabled: true },
        ],
        selectedId: "second",
        required: false,
      },
      presentation,
    ),
  );
  await render(
    <ThemeProvider mode="light">
      <ChoiceChips model={model} onChange={() => {}} />
    </ThemeProvider>,
  );
  const clear = screen.getByRole("button", { name: presentation.copy.kit.clear });
  expect(clear).toBeOnTheScreen();
  const line = pathTo(screen.toJSON() as Node, presentation.copy.kit.clear);
  // Somewhere on the way from the root to the reset there is one line, drawn sideways,
  // that holds both the reset and the name of the choice — and that line is not the row
  // of chips, which would make the reset look like a third chip.
  const held = line.find(
    (node) =>
      rowStyle(node) &&
      node.props?.accessibilityRole !== "radiogroup" &&
      JSON.stringify(node).includes("Pass option"),
  );
  expect(held).toBeDefined();
});
