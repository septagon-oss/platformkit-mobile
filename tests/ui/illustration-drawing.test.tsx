// The two inks of a drawing are the theme's: every stroke a picture paints is a
// palette colour of the mode it is drawn in, at the side and stroke the kit names,
// and the parts on screen are the parts the drawing table holds — in both themes.
import { describe, expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { illustrationNames, illustrations } from "../../src/core/derive";
import { Illustration } from "../../src/ui/atoms/Illustration";
import { ThemeProvider, themeFor } from "../../src/ui/theme";
import { palette } from "../../src/ui/tokens";

interface Node {
  readonly type?: string;
  readonly props?: Record<string, unknown>;
  readonly children?: readonly (Node | string)[];
}

/** nodesOf is every element of a rendered tree, whatever layer drew it. */
function nodesOf(node: Node | string | null | undefined, out: Node[] = []): Node[] {
  if (!node || typeof node === "string") return out;
  out.push(node);
  for (const child of node.children ?? []) nodesOf(child, out);
  return out;
}

const ink = (hex: string) => Number(`0xff${hex.slice(1)}`);

/**
 * ROUND is what react-native-svg turns the atom's `strokeLinecap="round"` and
 * `strokeLinejoin="round"` into on the rendered node; `fill="none"` arrives as no
 * fill at all. The claim below is about the drawing, so it is read where the
 * drawing is drawn.
 */
const ROUND = 1;

/** drawn is what the screen actually holds for one picture: its canvas and each of its strokes. */
function drawn(tree: Node | null) {
  const nodes = nodesOf(tree);
  const canvas = nodes.find((node) => node.type === "RNSVGSvgView")?.props;
  return {
    canvas: [canvas?.width, canvas?.height, canvas?.vbWidth, canvas?.vbHeight],
    paths: nodes
      .filter((node) => node.type === "RNSVGPath")
      .map((node) => ({
        d: node.props?.d,
        stroke: (node.props?.stroke as { payload: number }).payload,
        strokeWidth: node.props?.strokeWidth,
        fill: node.props?.fill,
        cap: node.props?.strokeLinecap,
        join: node.props?.strokeLinejoin,
      })),
  };
}

describe("Illustration", () => {
  for (const mode of ["light", "dark"] as const)
    test(`a drawing paints only the ${mode} theme's two inks, at the kit's own side and stroke`, async () => {
      const theme = themeFor(mode);
      const on = (part: "detail" | "line") =>
        ink(part === "detail" ? palette[mode].accentDefault : palette[mode].textPrimary);
      const seen: unknown[] = [];
      for (const name of illustrationNames) {
        const { toJSON } = await render(
          <ThemeProvider mode={mode}>
            <Illustration name={name} testID="picture" />
          </ThemeProvider>,
        );
        seen.push({ name, ...drawn(toJSON() as Node | null) });
        await screen.unmount();
      }
      expect(seen).toEqual(
        illustrationNames.map((name) => ({
          name,
          canvas: [theme.extent.illustration, theme.extent.illustration, 48, 48],
          paths: illustrations[name].parts.map((part) => ({
            d: part.d,
            stroke: on(part.ink),
            strokeWidth: theme.extent.illustrationStroke,
            fill: null,
            cap: ROUND,
            join: ROUND,
          })),
        })),
      );
    });

  test("the picture is a picture: twice a row's tile and no bigger than its own column", () => {
    const theme = themeFor("light");
    expect(theme.extent.illustration).toBeGreaterThan(theme.extent.rowMedia * 2);
    expect(theme.extent.illustration).toBeLessThan(theme.extent.pageColumn);
  });
});
