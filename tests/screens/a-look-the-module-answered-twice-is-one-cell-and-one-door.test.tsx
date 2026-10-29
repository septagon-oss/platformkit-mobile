// The ranking is the module's and it may move between two asks; the phone holds one cell per look.
// A window that arrives overlapping the one on screen — the same look under the same key, because a
// key is that look's recipe with the colours actually worn — joins it once and opens one door, so a
// person who pressed the second copy would not be reading the same look twice.

import { beforeEach, describe, expect, test, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { OutfitLooks } from "../../src/packs/outfit/looks";
import { looksEntry, outfitApi, suggestionAt } from "../fakes/outfit";
import { reset } from "../fakes/router";
import { shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/organisms/MasonryWall", () => ({
  MasonryWall: require("../fakes/wall").MasonryWall,
}));

beforeEach(() => {
  reset();
});

test("a look the module answered twice is one cell of the wall and one door", async () => {
  // The next window starts two looks back: the module re-ran and handed two looks over again.
  shell.value = shellValue(outfitApi({ "?skip=4": suggestionAt(2) }));
  const view = await render(<OutfitLooks entry={looksEntry} />);
  await waitFor(() => expect(JSON.stringify(view.toJSON())).toContain("Evening walk"));
  fireEvent.press(screen.getByRole("button", { name: "More ideas" }));
  await waitFor(() => expect(JSON.stringify(view.toJSON())).toContain("Studio lines"));
  // Four drawn, then a window of which only two were new.
  expect(screen.getAllByTestId("media-cell")).toHaveLength(6);
  for (const name of ["City layers", "Soft weekend", "Gallery day", "Evening walk"]) {
    // Named once, so opened from one place: a second cell would name it a second time.
    expect(screen.getAllByText(name)).toHaveLength(1);
  }
});
