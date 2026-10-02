// A player's controls are announced in the person's language: the kit already
// carries the words (copy.kit.play, copy.kit.pause), so a control named by its
// intent id ("play", "pause") is copy written in a component.
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { deriveCopy, type Presentation } from "../../src/core/derive";
import { derivePlayback } from "../../src/core/progress";
import { MiniPlayer } from "../../src/ui/molecules/MiniPlayer";
import { ThemeProvider } from "../../src/ui/theme";

const portuguese: Presentation = {
  locale: "pt-PT",
  timeZone: "UTC",
  now: "2026-07-18T09:00:00Z",
  weekStartsOn: 1,
  motion: "reduced",
  copy: deriveCopy("pt"),
};

const model = (() => {
  const result = derivePlayback({ position: 12, total: 300, label: "A tocar" }, portuguese);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
})();

const cases: [boolean, "play" | "pause"][] = [
  [false, "play"],
  [true, "pause"],
];

test.each(cases)(
  "playing=%s: the toggle speaks copy.kit.%s in Portuguese",
  async (playing, word) => {
    await render(
      <ThemeProvider mode="light">
        <MiniPlayer
          model={model}
          title="Episódio"
          playing={playing}
          onIntent={() => undefined}
          testID="player"
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("player-toggle")).toHaveProp(
      "accessibilityLabel",
      portuguese.copy.kit[word],
    );
  },
);
