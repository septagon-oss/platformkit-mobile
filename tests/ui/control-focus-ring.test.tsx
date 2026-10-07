// Every control draws focus-visible the way Button does: a keyboard or switch
// user who moves focus onto a tab or a player control sees where it landed, in
// the theme's focus colour.
import { expect, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import { deriveTabs } from "../../src/core/navigation";
import { derivePlayback } from "../../src/core/progress";
import { MiniPlayer } from "../../src/ui/molecules/MiniPlayer";
import { TabBar } from "../../src/ui/molecules/TabBar";
import { ThemeProvider, themeFor } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const focus = themeFor("light").color.focus;

const ringed = (id: string): boolean => {
  const style = StyleSheet.flatten(screen.getByTestId(id).props.style) ?? {};
  return style.borderColor === focus || style.outlineColor === focus;
};

test("a tab moved onto by the keyboard draws the focus ring", async () => {
  const tabs = deriveTabs(
    {
      tabs: [
        { id: "inbox", label: "Inbox" },
        { id: "later", label: "Later" },
      ],
      selected: "inbox",
    },
    presentation,
  );
  if (!tabs.ok) throw new Error(JSON.stringify(tabs.issues));
  await render(
    <ThemeProvider mode="light">
      <TabBar model={tabs.value} onSelect={() => undefined} testID="tabs" />
    </ThemeProvider>,
  );
  expect(ringed("tabs:later")).toBe(false);
  await fireEvent(screen.getByTestId("tabs:later"), "focus");
  expect(ringed("tabs:later")).toBe(true);
});

test("a player control moved onto by the keyboard draws the focus ring", async () => {
  const playback = derivePlayback({ position: 40, total: 180, label: "Now playing" }, presentation);
  if (!playback.ok) throw new Error(JSON.stringify(playback.issues));
  await render(
    <ThemeProvider mode="light">
      <MiniPlayer
        model={playback.value}
        title="Chapter four"
        playing={false}
        onIntent={() => undefined}
        testID="player"
      />
    </ThemeProvider>,
  );
  expect(ringed("player-toggle")).toBe(false);
  await fireEvent(screen.getByTestId("player-toggle"), "focus");
  expect(ringed("player-toggle")).toBe(true);
});
