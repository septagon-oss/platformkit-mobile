// A container marked `accessible` becomes one accessibility element: on iOS its
// child buttons are no longer reachable one by one. A tab bar whose tabs a
// screen-reader user cannot reach, or a player strip whose play button is
// folded into the strip, holds back the controls it exists to offer. And a
// strip that cannot be sought is not announced as adjustable.
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { deriveTabs } from "../../src/core/navigation";
import { derivePlayback } from "../../src/core/progress";
import { MiniPlayer } from "../../src/ui/molecules/MiniPlayer";
import { TabBar } from "../../src/ui/molecules/TabBar";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

test("the tab list leaves each tab its own accessibility element", async () => {
  const tabs = deriveTabs(
    {
      tabs: [
        { id: "inbox", label: "Inbox" },
        { id: "later", label: "Later" },
        { id: "done", label: "Done" },
      ],
      selected: "done",
    },
    presentation,
  );
  if (!tabs.ok) throw new Error(JSON.stringify(tabs.issues));
  await render(
    <ThemeProvider mode="light">
      <TabBar model={tabs.value} onSelect={() => undefined} testID="tabs" />
    </ThemeProvider>,
  );
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  expect(screen.getByTestId("tabs").props.accessible).not.toBe(true);
});

test("the player strip leaves its controls reachable, and is not adjustable when unseekable", async () => {
  const live = derivePlayback({ position: 600, label: "Live" }, presentation);
  if (!live.ok) throw new Error(JSON.stringify(live.issues));
  expect(live.value.seekable).toBe(false);
  await render(
    <ThemeProvider mode="light">
      <MiniPlayer
        model={live.value}
        title="Morning radio"
        playing
        onIntent={() => undefined}
        controls={{ back: true, forward: true }}
        testID="player"
      />
    </ThemeProvider>,
  );
  expect(screen.getByTestId("player-toggle")).toBeOnTheScreen();
  const strip = screen.getByTestId("player");
  expect(strip.props.accessible).not.toBe(true);
  expect(strip.props.accessibilityRole).not.toBe("adjustable");
});
