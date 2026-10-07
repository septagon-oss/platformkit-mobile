// The card a person stops on answers one verb right now — play, or pause — and
// the two skips beside it are corrections to that answer. Drawn as three discs of
// one size hugging a corner, the transport says "a control demo" and the listener
// has to work out which one is the point. The strip over a list is one line tall
// by design and stays three fingertip controls; the card makes its one answer the
// largest thing on it and centres the line under the scrubber it belongs to.
import { presentation } from "../fakes/presentation";
import { describe, expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import { derivePlayback } from "../../src/core/progress";
import { MiniPlayer } from "../../src/ui/molecules/MiniPlayer";
import { hit } from "../../src/ui/scale";
import { ThemeProvider } from "../../src/ui/theme";

const model = () => {
  const result = derivePlayback(
    { position: 95, total: 210, label: "Print room tour" },
    presentation,
  );
  if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}/${i.code}`).join(", "));
  return result.value;
};

const card = (collapsed: boolean) =>
  render(
    <ThemeProvider mode="light">
      <MiniPlayer
        model={model()}
        title="The print room in morning light"
        playing
        collapsed={collapsed}
        onIntent={jest.fn()}
        controls={{ back: true, forward: true }}
        testID="player"
      />
    </ThemeProvider>,
  );

const shape = (id: string) => {
  const style = screen.getByTestId(id).props.style;
  const resolved =
    typeof style === "function"
      ? (style as (state: { pressed: boolean }) => object)({ pressed: false })
      : style;
  return StyleSheet.flatten(resolved) as { width?: number; height?: number };
};

describe("the player's transport says which control answers", () => {
  test("the card draws its one answer larger than the two skips beside it", async () => {
    await card(false);
    const toggle = shape("player-toggle");
    const back = shape("player-back");
    const forward = shape("player-forward");
    expect(back.width).toBe(forward.width);
    expect(toggle.width).toBeGreaterThan(back.width!);
    expect(toggle.height).toBeGreaterThan(back.height!);
    expect(toggle.width!).toBeGreaterThan(hit);
  });

  test("the strip over a list keeps three controls of one fingertip size", async () => {
    await card(true);
    const parts = ["player-toggle", "player-back", "player-forward"];
    expect(new Set(parts.map((part) => shape(part).width)).size).toBe(1);
    expect(shape("player-toggle").width).toBe(hit);
  });
});
