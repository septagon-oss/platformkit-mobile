// A look is drawn from one read, and the frame it is drawn on is the look's own: the module paints
// `background` into the record, and `MediaHero`'s `ground` is what holds that frame while the
// flat-lay arrives — or if it never does. Nothing else on this kit paints a record's colour, so this
// is the case that says the prop arrived at the frame rather than at the model.
import { beforeEach, describe, expect, test, jest } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { OutfitLook } from "../../src/packs/outfit/look";
import { firstKey, looksEntry, outfitApi } from "../fakes/outfit";
import { reset } from "../fakes/router";
import { shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));

/** painted lists every background colour drawn anywhere in a rendered tree, in the order it was drawn. */
function painted(node: unknown, at: (style: unknown) => string): string[] {
  if (Array.isArray(node)) return node.flatMap((child) => painted(child, at));
  if (node === null || typeof node !== "object") return [];
  const element = node as {
    readonly props?: { readonly style?: unknown };
    readonly children?: unknown;
  };
  const here = element.props ? [at(element.props.style)].filter((hex) => hex !== "") : [];
  return [...here, ...painted(element.children, at)];
}

/** paintedHex reads the one colour a style sets as its background, whichever form the style took. */
const paintedHex = (style: unknown): string => {
  const flat = (Array.isArray(style) ? style : [style])
    .map((part) => (part && typeof part === "object" ? part : {}))
    .reduce<Record<string, unknown>>((was, part) => ({ ...was, ...part }), {});
  const colour = flat.backgroundColor;
  return typeof colour === "string" ? colour.toUpperCase() : "";
};

const tick = async (): Promise<void> =>
  act(async () => {
    await new Promise((settle) => setTimeout(settle, 0));
  });

beforeEach(() => {
  reset();
  shell.value = shellValue(outfitApi());
});

describe("the ground a look is drawn on", () => {
  test("the frame the flat-lay arrives into wears the look's own colour, and no other surface does", async () => {
    const view = await render(<OutfitLook entry={looksEntry} id={firstKey()} />);
    await tick();
    await waitFor(() => expect(screen.getByText("City layers")).toBeTruthy());
    // tests/fakes/outfit.ts gives every look the ground the design's own bg attribute carries.
    expect(painted(view.toJSON(), paintedHex)).toContain("#ECE8E1");
    // The record's colour is painted on the frame and nowhere else: the pieces keep the colours the
    // module painted them in, and no page role is repainted from a body that describes a garment.
    expect(painted(view.toJSON(), paintedHex).filter((hex) => hex === "#ECE8E1")).toHaveLength(1);
  });
});
