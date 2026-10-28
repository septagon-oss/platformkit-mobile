// The look page draws what the module composed: the flat-lay, the look's own name, the two answers it
// was composed under, and one line per piece in the order they were laid out — each with the colour
// that paints it. It re-words no garment, groups none by which part of the body it covers, and draws
// no heart this build cannot answer for.

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
jest.mock("../../src/ui/organisms/MasonryWall", () => ({
  MasonryWall: require("../fakes/wall").MasonryWall,
}));

const tick = async (): Promise<void> =>
  act(async () => {
    await new Promise((settle) => setTimeout(settle, 0));
  });

beforeEach(() => {
  reset();
  shell.value = shellValue(outfitApi());
});

describe("one look", () => {
  test("every piece is drawn once, in order, with the colour that paints it", async () => {
    const view = await render(<OutfitLook entry={looksEntry} id={firstKey()} />);
    await tick();
    await waitFor(() => expect(screen.getByText("City layers")).toBeTruthy());
    const tree = JSON.stringify(view.toJSON());
    const lines = [
      "Terracotta wool coat",
      "Ivory straight trousers",
      "Brown leather boots",
      "Denim-blue scarf",
    ];
    const at = lines.map((line) => tree.indexOf(line));
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(at.every((found) => found > 0)).toBe(true);
    // The colour each line is painted in is drawn beside it, and the module's part name is not
    // drawn: the design prints no "Top:" label, and the line is the module's whole sentence.
    expect(tree).toContain("#C8643F");
    expect(tree).not.toContain("Top:");
    // The answers the look was composed under, printed as the module printed them.
    expect(tree).toContain("Autumn · Minimal");
  });

  test("the look offers the next idea, and keeps a copy only where this build answers for one", async () => {
    render(<OutfitLook entry={looksEntry} id={firstKey()} />);
    await tick();
    await waitFor(() => expect(screen.getByText("City layers")).toBeTruthy());
    expect(screen.getAllByRole("button", { name: "Another idea" })).toHaveLength(1);
    // No saved port is composed in this build, so no heart is drawn — not a grey one, not an inert
    // one, and nothing is said about a copy nobody has asked about.
    expect(screen.queryByTestId("saved-heart")).toBeNull();
    expect(screen.queryByRole("button", { name: /lookbook/i })).toBeNull();
  });
});
