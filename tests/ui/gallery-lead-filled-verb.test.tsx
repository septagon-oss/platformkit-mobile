import { expect, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { StyleSheet, type PressableStateCallbackType, type ViewStyle } from "react-native";
import { galleryPageIds } from "../../src/core/galleryPages";
import { Gallery } from "../../src/ui/gallery";
import { themeFor } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const background = (style: unknown): unknown => {
  const supplied = style as ViewStyle | ((state: PressableStateCallbackType) => ViewStyle);
  return StyleSheet.flatten(
    typeof supplied === "function" ? supplied({ pressed: false, hovered: false }) : supplied,
  )?.backgroundColor;
};

test.each(galleryPageIds)("the %s page draws its own screen", async (id) => {
  await render(<Gallery presentation={presentation} page={id} />);
  expect(screen.getByTestId(`gallery-page:${id}`)).toBeOnTheScreen();
  expect(screen.queryByTestId("gallery-page:invalid")).toBeNull();
});

test("the player page holds one filled verb, its states shut and open", async () => {
  await render(<Gallery presentation={presentation} page="player" />);
  expect(screen.getByTestId("gallery-page:player")).toBeOnTheScreen();

  const accent = themeFor("light").color.accentDefault;
  const drawn = () => {
    const toggles = screen.getAllByTestId("gallery-player-toggle");
    return {
      // how many strips the fold holds, how many of them are filled, and whether
      // the first — the page's own screen — is the filled one
      strips: toggles.length,
      filled: toggles.filter((control) => background(control.props.style) === accent).length,
      lead: background(toggles[0]!.props.style),
    };
  };
  // Shut, the fold holds the screen the page stands for and nothing else.
  expect(drawn()).toEqual({ strips: 1, filled: 1, lead: accent });
  // Open, the page's other specimen joins it and one filled verb is still the rule.
  await fireEvent.press(screen.getByRole("button", { name: presentation.copy.kit.expand }));
  expect(drawn()).toEqual({ strips: 2, filled: 1, lead: accent });
});
