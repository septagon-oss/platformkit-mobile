// The wall of looks is the module's ranking, not one the phone made: the looks it answered for this
// window, in the order it answered them, each named by the look's own name and captioned by the
// module's own pieces line, never re-joined or re-sorted here.

import { beforeEach, describe, expect, test, jest } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { OutfitLooks } from "../../src/packs/outfit/looks";
import { looksEntry, outfitApi } from "../fakes/outfit";
import { reset } from "../fakes/router";
import { shell, shellValue, type FakeApi } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/organisms/MasonryWall", () => ({
  MasonryWall: require("../fakes/wall").MasonryWall,
}));

let api: FakeApi & { readonly asks: () => readonly string[] };

async function wall() {
  const view = await render(<OutfitLooks entry={looksEntry} />);
  await act(async () => {
    await new Promise((settle) => setTimeout(settle, 0));
  });
  return view;
}

beforeEach(() => {
  reset();
  api = outfitApi();
  shell.value = shellValue(api);
});

describe("the wall of looks", () => {
  test("the looks stand in the order the read ranked them, named and captioned", async () => {
    const view = await wall();
    await waitFor(() => expect(screen.getByText("Evening walk")).toBeTruthy());
    const tree = JSON.stringify(view.toJSON());
    const order = ["City layers", "Soft weekend", "Gallery day", "Evening walk"].map((name) =>
      tree.indexOf(name),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((at) => at > 0)).toBe(true);
    // The next window was not drawn: five looks were answered, four belong here.
    expect(tree).not.toContain("Studio lines");
    // The line under a name is the module's own join of its piece nouns, printed as it joined them.
    expect(tree).toContain("Coat · trousers · boots");
    expect(tree).toContain("Knit · jeans · sneakers");
    // One ask, at the collection with no window of its own: the answer says where the next starts.
    expect(api.asks()).toEqual(["/api/v1/outfit/looks"]);
  });
});
