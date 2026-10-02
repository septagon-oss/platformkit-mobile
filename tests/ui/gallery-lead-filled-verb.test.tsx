import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
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

test("the lead player strip keeps the screen's one filled verb", async () => {
  await render(<Gallery presentation={presentation} page="player" />);
  expect(screen.getByTestId("gallery-page:player")).toBeOnTheScreen();

  const accent = themeFor("light").color.accentDefault;
  const toggles = screen.getAllByTestId("gallery-player-toggle");
  const filled = toggles.filter((control) => background(control.props.style) === accent);
  expect(toggles.length).toBeGreaterThan(1);
  expect(filled).toHaveLength(1);
  expect(background(toggles[0]!.props.style)).toBe(accent);
});
