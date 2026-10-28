// The answers a person is being suggested with are true information whether or not this installation
// mounted the questions: the colours, the season and the style are drawn either way, and the press
// that goes back to them appears only where the entry actually offers a create. A caption that looks
// pressable and opens nothing is a door somebody else's absence would have to explain.

import { beforeEach, describe, expect, test, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import type { Entry } from "../../src/core/catalog";
import { OutfitLooks } from "../../src/packs/outfit/looks";
import { looksEntry, outfitApi } from "../fakes/outfit";
import { navigations, reset } from "../fakes/router";
import { shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/organisms/MasonryWall", () => ({
  MasonryWall: require("../fakes/wall").MasonryWall,
}));

const askAgain: Entry = { ...looksEntry, operations: ["list", "read", "create"] };

const opened = async (entry: Entry): Promise<{ toJSON(): unknown }> => {
  const view = await render(<OutfitLooks entry={entry} />);
  await waitFor(() => expect(JSON.stringify(view.toJSON())).toContain("Autumn · Minimal"));
  return view;
};

beforeEach(() => {
  reset();
  shell.value = shellValue(outfitApi());
});

describe("the answers a person is suggested with", () => {
  test("each colour is named, and the press opens the questions the entry mounts", async () => {
    await opened(askAgain);
    const pill = screen.getByTestId("outfit-answers");
    expect(String(pill.props.accessibilityLabel)).toBe("Autumn · Minimal");
    expect(
      screen
        .getAllByTestId("outfit-answer-colour")
        .map((disc) => String(disc.props.accessibilityLabel)),
    ).toEqual(["Terracotta", "Ivory", "Denim"]);
    fireEvent.press(pill);
    expect(navigations).toContain("/outfit/look/new");
  });

  test("an entry that mounts no questions draws the answers with no press", async () => {
    await opened(looksEntry);
    expect(screen.queryByTestId("outfit-answers")).toBeNull();
    // The line itself stays: what was answered is true whatever doors were mounted.
    expect(screen.getByText("Autumn · Minimal")).toBeTruthy();
    expect(screen.getAllByTestId("outfit-answer-colour")).toHaveLength(3);
  });
});
