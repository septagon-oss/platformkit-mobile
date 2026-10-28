// "Another idea" on the look page leaves one instruction in the address of the wall; the wall reads
// it once, walks to the window after the one it holds, and clears its own address so a reload asks for
// what is on screen rather than for the idea someone asked for two screens ago. A wall that is mounted
// under the instruction — opened from a kept copy, with no wall behind it — takes the same step once
// it has a window to step from, and an instruction in no spelling the wall knows leaves the window
// where it was.

import { beforeEach, describe, expect, test, jest } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { OutfitLook } from "../../src/packs/outfit/look";
import { OutfitLooks } from "../../src/packs/outfit/looks";
import { firstKey, looksEntry, outfitApi } from "../fakes/outfit";
import { navigations, reset, router, setParams } from "../fakes/router";
import { shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/organisms/MasonryWall", () => ({
  MasonryWall: require("../fakes/wall").MasonryWall,
}));

let api: ReturnType<typeof outfitApi>;

const tick = async (): Promise<void> =>
  act(async () => {
    await new Promise((settle) => setTimeout(settle, 0));
  });

beforeEach(() => {
  reset();
  api = outfitApi();
  shell.value = shellValue(api);
});

const wall = () => <OutfitLooks entry={looksEntry} />;

/** shown renders the wall and waits for the window it opened on to be drawn. */
const shown = async () => {
  const view = await render(wall());
  await waitFor(() => expect(JSON.stringify(view.toJSON())).toContain("Evening walk"));
  return view;
};

describe("the idea carried between two screens", () => {
  test("the look's own door asks for one window further on and clears the address", async () => {
    const look = await render(<OutfitLook entry={looksEntry} id={firstKey()} />);
    await waitFor(() => expect(JSON.stringify(look.toJSON())).toContain("City layers"));
    fireEvent.press(screen.getByRole("button", { name: "Another idea" }));
    expect(router.replace).toHaveBeenCalledWith("/outfit/look?idea=1");
  });

  test("the wall walks the window the address asked for, then holds no stale instruction", async () => {
    const view = await shown();
    setParams({ idea: "1" });
    await view.rerender(wall());
    await tick();
    // The step is the length of the window that was answered, not one this phone counted.
    expect(api.asks()).toEqual(["/api/v1/outfit/looks", "/api/v1/outfit/looks?skip=4"]);
    // The window was replaced rather than appended: the looks that sit in no part of the new window
    // are off the wall, and the wall holds one window's count of cells.
    const tree = JSON.stringify(view.toJSON());
    expect(tree).toContain("Studio lines");
    expect(tree).not.toContain("Gallery day");
    expect(screen.getAllByTestId("media-cell")).toHaveLength(4);
    // And the address the instruction arrived in is the bare wall again.
    expect(navigations).toContain("/outfit/look");
    view.unmount();
    reset();
  });

  test("a wall mounted under the instruction reads one window, then takes the step it was asked for", async () => {
    setParams({ idea: "1" });
    const view = await render(wall());
    await tick();
    await waitFor(() => expect(JSON.stringify(view.toJSON())).toContain("Studio lines"));
    // A wall with no window yet has no length to step by, so it reads the one it opened on first and
    // honours the instruction against it rather than dropping it.
    expect(api.asks()).toEqual(["/api/v1/outfit/looks", "/api/v1/outfit/looks?skip=4"]);
    expect(navigations).toContain("/outfit/look");
    view.unmount();
    reset();
  });

  test("an instruction in no spelling the wall knows leaves the window where it is", async () => {
    setParams({ idea: "9" });
    const view = await render(wall());
    await tick();
    await waitFor(() => expect(JSON.stringify(view.toJSON())).toContain("Evening walk"));
    expect(api.asks()).toEqual(["/api/v1/outfit/looks"]);
    expect(navigations).not.toContain("/outfit/look");
    view.unmount();
    reset();
  });
});
