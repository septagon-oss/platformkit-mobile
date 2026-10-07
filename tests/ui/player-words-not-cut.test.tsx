// What is playing has to be readable, not merely present. The strip over a list
// is one line tall by design; the card a person stops on is not, and drawing it
// like the strip cut the tour's name to "The print room…" and left the reason for
// having no position unsaid. The words are what the transport must not squeeze.
import { presentation } from "../fakes/presentation";
import { describe, expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import { derivePlayback } from "../../src/core/progress";
import { MiniPlayer } from "../../src/ui/molecules/MiniPlayer";
import { ThemeProvider } from "../../src/ui/theme";

const unmeasured = () => {
  const result = derivePlayback({ position: 95, label: "Print room tour" }, presentation);
  if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}/${i.code}`).join(", "));
  return result.value;
};

const card = (collapsed: boolean) =>
  render(
    <ThemeProvider mode="light">
      <MiniPlayer
        model={unmeasured()}
        title="The print room in morning light"
        playing
        collapsed={collapsed}
        onIntent={jest.fn()}
        controls={{ back: true, forward: true }}
        testID="player"
      />
    </ThemeProvider>,
  );

describe("the player gives its words the space the transport takes", () => {
  test("the card writes its title and its reason in more than one line", async () => {
    await card(false);
    for (const words of ["The print room in morning light", "1:35"]) {
      const lines = screen.getByText(words, { exact: false }).props.numberOfLines;
      expect(lines).toBeGreaterThan(1);
    }
  });
  test("the card stands the transport under the words, not beside them", async () => {
    await card(false);
    const strip = StyleSheet.flatten(screen.getByTestId("player").props.style) ?? {};
    expect(strip).toMatchObject({ flexDirection: "column" });
    expect(screen.getByTestId("player-toggle")).toBeOnTheScreen();
  });

  test("the strip over a list stays one line and keeps its transport beside it", async () => {
    await card(true);
    expect(screen.getByText("The print room in morning light").props.numberOfLines).toBe(1);
    const strip = StyleSheet.flatten(screen.getByTestId("player").props.style) ?? {};
    expect(strip.flexDirection).not.toBe("column");
  });

  /**
   * The scrubber measures the whole track, so it is drawn across the card. Held in
   * the text column it was as wide as the words left over beside the picture — at
   * 390px, 194 of the card's 334 — and the picture and the progress fought over one
   * row. The strip owns no scrubber at all, so it keeps its one line.
   */
  test("the card's scrubber runs the card's width, and the strip draws no scrubber", async () => {
    await card(false);
    const track = screen.getByTestId("kit-player-track");
    expect((track.parent as { props?: { testID?: string } })?.props?.testID).toBe("player");
    const cardStyle = StyleSheet.flatten(screen.getByTestId("player").props.style) ?? {};
    expect(cardStyle.alignItems).toBe("stretch");
    await card(true);
    expect(screen.queryByTestId("kit-player-track")).toBeNull();
  });
});
