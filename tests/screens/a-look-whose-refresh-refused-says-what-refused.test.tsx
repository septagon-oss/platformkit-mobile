// A look already on screen is a read that has not been asked about since the person arrived. When
// the read that refreshes it refuses, the wall of looks answers with a sentence and keeps its cards;
// the look page owes the same answer, because a record shown as though it were current after the
// service said otherwise is the one thing a derived read may not do — and the heart beside it offers
// a write against exactly that record.
import { beforeEach, describe, expect, test, jest } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
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

const page = (): React.ReactElement => <OutfitLook entry={looksEntry} id={firstKey()} />;

/** refreshed renders the look, then asks for it again over a transport that refuses this time. */
const refreshed = async (): Promise<{
  tree: () => string;
  asks: () => readonly string[];
  rerender: () => Promise<unknown>;
}> => {
  shell.value = shellValue(outfitApi());
  const view = await render(page());
  await tick();
  await waitFor(() => expect(screen.getByText("City layers")).toBeTruthy());
  const refused = outfitApi({
    [encodeURIComponent(firstKey())]: new Error("the service went away"),
  });
  shell.value = shellValue(refused);
  return {
    tree: () => JSON.stringify(view.toJSON()),
    asks: refused.asks,
    rerender: () => view.rerender(page()),
  };
};

beforeEach(() => {
  reset();
});

describe("a look whose refresh refused", () => {
  test("the page says what refused and keeps the look it had drawn", async () => {
    const drawn = await refreshed();
    await drawn.rerender();
    await tick();
    await tick();
    // The screen really did ask for the look again, and the service really did refuse it.
    expect(drawn.asks()).toContain(`/api/v1/outfit/looks/${encodeURIComponent(firstKey())}`);
    const tree = drawn.tree();
    expect(tree).toContain("This could not be loaded");
    // Nothing was emptied: the look that is still the last one this phone read stays on screen.
    expect(tree).toContain("City layers");
    expect(tree).toContain("Terracotta wool coat");
  });

  test("the sentence offers the way to ask for it again", async () => {
    const again = await refreshed();
    await again.rerender();
    await tick();
    await tick();
    const before = again.asks().length;
    fireEvent.press(screen.getByRole("button", { name: /^Retry/ }));
    await tick();
    expect(again.asks()).toHaveLength(before + 1);
  });
});
