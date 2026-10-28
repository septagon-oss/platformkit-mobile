// A suggestion outside the module's shape is refused as a whole. The transport runs the pack's own
// validator on every success, so a renamed member, a colour in the wrong case or a window with no
// position arrives as a refusal and never as a card with something missing from it.

import { beforeEach, describe, expect, test, jest } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react-native";
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

const whole = suggestionAt(0);
const four = ["City layers", "Soft weekend", "Gallery day", "Evening walk"];

/** unusable are the bodies a person must not be shown: each is one member away from the module's. */
const unusable: readonly (readonly [string, unknown])[] = [
  ["a window with no position", { ...whole, skip: -1 }],
  ["a window that does not say whether it ended", { ...whole, ended: undefined }],
  [
    "a look with no address",
    { ...whole, looks: whole.looks.map(({ ref: _ref, ...rest }) => rest) },
  ],
  [
    "a colour spelled in lower case",
    { ...whole, colours: [{ id: "clay", name: "Clay", hex: "#c8643f" }] },
  ],
  [
    "a picture that names a stored file",
    {
      ...whole,
      looks: whole.looks.map((look) => ({
        ...look,
        picture: "6f1f2a3b-4c5d-6e7f-8a9b-0c1d2e3f4a5b",
      })),
    },
  ],
];

beforeEach(() => {
  reset();
});

describe.each(unusable)("a suggestion the phone cannot read: %s", (_says, body) => {
  test("the whole read is refused and no look is drawn", async () => {
    shell.value = shellValue(outfitApi({ looks: body }));
    const view = await render(<OutfitLooks entry={looksEntry} />);
    await waitFor(() =>
      expect(JSON.stringify(view.toJSON())).toContain("This could not be loaded"),
    );
    const tree = JSON.stringify(view.toJSON());
    for (const name of four) expect(tree).not.toContain(name);
    expect(screen.queryAllByTestId("media-cell")).toHaveLength(0);
  });
});
