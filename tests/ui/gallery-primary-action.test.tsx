import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { StyleSheet, type PressableStateCallbackType, type ViewStyle } from "react-native";
import { Gallery } from "../../src/ui/gallery";
import { themeFor } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

test("the player page offers at most one filled action", async () => {
  await render(<Gallery presentation={presentation} page="player" />);
  expect(screen.getByTestId("gallery-page:player")).toBeOnTheScreen();

  const accent = themeFor("light").color.accentDefault;
  const filled = screen.getAllByTestId("gallery-player-toggle").filter((control) => {
    const supplied = control.props.style as
      ViewStyle | ((state: PressableStateCallbackType) => ViewStyle);
    const style = StyleSheet.flatten(
      typeof supplied === "function" ? supplied({ pressed: false, hovered: false }) : supplied,
    );
    return style.backgroundColor === accent;
  });
  expect(filled.length).toBeLessThanOrEqual(1);
});
