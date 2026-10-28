// "Another idea" on the look page leaves one instruction in the address of the wall; the wall reads
// it once, walks to the window after the one it holds, and clears its own address so a reload asks for
// what is on screen rather than for the idea someone asked for two screens ago.

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

describe("the idea carried between two screens", () => {
  test("the look's own door asks for one window further on and clears the address", async () => {
    const look = await render(<OutfitLook entry={looksEntry} id={firstKey()} />);
    await waitFor(() => expect(JSON.stringify(look.toJSON())).toContain("City layers"));
    fireEvent.press(screen.getByRole("button", { name: "Another idea" }));
    expect(router.replace).toHaveBeenCalledWith("/outfit/look?idea=1");
  });

  test("the wall walks the window the address asked for, then holds no stale instruction", async () => {
    const view = await render(wall());
    await waitFor(() => expect(JSON.stringify(view.toJSON())).toContain("Evening walk"));
    setParams({ idea: "1" });
    await view.rerender(wall());
    await tick();
    // The step is the length of the window that was answered, not one this phone counted.
    expect(api.asks()).toEqual(["/api/v1/outfit/looks", "/api/v1/outfit/looks?skip=4"]);
    // The window was replaced rather than appended: the four before it are gone.
    const tree = JSON.stringify(view.toJSON());
    expect(tree).toContain("Studio lines");
    expect(tree).not.toContain("City layers");
    // And the address the instruction arrived in is the bare wall again.
    expect(navigations).toContain("/outfit/look");
    view.unmount();
    reset();
  });
});
