// The window of looks moves where the read said it had got to: the next ask starts after the window
// that was answered, a window the module ended leaves no door to the next one, and a window that
// refused leaves the looks already drawn where they were.

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

let api: ReturnType<typeof outfitApi>;

/** opened renders the wall and waits for the window it asked for to be drawn. */
const opened = async (): Promise<{ toJSON(): unknown }> => {
  const view = await render(<OutfitLooks entry={looksEntry} />);
  await waitFor(() => expect(JSON.stringify(view.toJSON())).toContain("Evening walk"));
  return view;
};

beforeEach(() => {
  reset();
  api = outfitApi();
  shell.value = shellValue(api);
});

describe("the window of looks", () => {
  test("more ideas asks for the window after the one that was answered and joins it to the wall", async () => {
    const view = await opened();
    fireEvent.press(screen.getByRole("button", { name: "More ideas" }));
    await waitFor(() => expect(JSON.stringify(view.toJSON())).toContain("Market run"));
    // The step is the length of the window the read answered, not one this phone counted.
    expect(api.asks()).toEqual(["/api/v1/outfit/looks", "/api/v1/outfit/looks?skip=4"]);
    const tree = JSON.stringify(view.toJSON());
    // The foot appended rather than replaced: the looks already read still lead the wall.
    expect(tree).toContain("City layers");
    expect(tree).toContain("Studio lines");
    // Two windows, six looks, one cell each: a key the vocabulary moved cannot be a cell twice.
    expect(screen.getAllByTestId("media-cell")).toHaveLength(6);
  });

  test("a window the module ended offers no way on, because there is none under these answers", async () => {
    api = outfitApi({ looks: suggestionAt(2) });
    shell.value = shellValue(api);
    const view = await render(<OutfitLooks entry={looksEntry} />);
    await waitFor(() => expect(JSON.stringify(view.toJSON())).toContain("Market run"));
    // Not a disabled control: the door is not drawn at all.
    expect(screen.queryByRole("button", { name: "More ideas" })).toBeNull();
  });

  test("a window that refused keeps the looks already drawn and says what went wrong", async () => {
    const view = await opened();
    const before = screen.getAllByTestId("media-cell").length;
    api = outfitApi({ "?skip=4": new Error("the service went away") });
    shell.value = shellValue(api);
    fireEvent.press(screen.getByRole("button", { name: "More ideas" }));
    await waitFor(() =>
      expect(JSON.stringify(view.toJSON())).toContain("This could not be loaded"),
    );
    const tree = JSON.stringify(view.toJSON());
    expect(tree).toContain("City layers");
    expect(tree).toContain("Evening walk");
    // Nothing was appended by an answer that never arrived, and the way on is still owed.
    expect(screen.getAllByTestId("media-cell")).toHaveLength(before);
    expect(screen.getByRole("button", { name: "More ideas" })).toBeTruthy();
  });
});
