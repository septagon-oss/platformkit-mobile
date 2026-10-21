// A deck screen that reaches its end through a command this phone sent plays the product's finishing
// renderer, supplied once to the shell, inside the end state; the renderer's end stops it and leaves the
// same caught-up title and counts. A person who asked for less motion is shown the end with no renderer,
// and the finish that arrival owed is spent: turning motion on afterwards does not play it late.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import React from "react";
import { AccessibilityInfo, Pressable } from "react-native";
import { ResourceDeck } from "../../src/screens/ResourceDeck";
import type { FinishingProps } from "../../src/ui/organisms/ResourceDetail";
import { deckEntryFixture, deckRows } from "../fakes/deck";
import { feedback } from "../fakes/presentation";
import { reset } from "../fakes/router";
import { fakeApi, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const entry = deckEntryFixture();
const words = feedback.copy.review;
let api: ReturnType<typeof fakeApi>;
let drawn: FinishingProps[];
let motionListeners: ((reduced: boolean) => void)[];

function Finishing(props: FinishingProps) {
  drawn.push(props);
  return <Pressable testID="finishing-renderer" onPress={props.onEnd} />;
}

/** reach mounts the deck over a one-card queue under the given motion and accepts that card. */
async function reach(reduced: boolean) {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(reduced);
  const listen = (name: string, listener: (reduced: boolean) => void) => {
    if (name === "reduceMotionChanged") motionListeners.push(listener);
    return { remove: () => undefined };
  };
  jest
    .spyOn(AccessibilityInfo, "addEventListener")
    .mockImplementation(listen as unknown as typeof AccessibilityInfo.addEventListener);
  await render(<ResourceDeck entry={entry} />);
  await waitFor(() => expect(screen.getByTestId("deck-right")).not.toBeDisabled());
  await fireEvent.press(screen.getByTestId("deck-right"));
  await waitFor(() =>
    expect(within(screen.getByTestId("deck-end")).getByText(words.caughtUp)).toBeTruthy(),
  );
  expect(api.command).toHaveBeenCalledTimes(1);
}

beforeEach(() => {
  reset();
  jest.clearAllMocks();
  drawn = [];
  motionListeners = [];
  api = fakeApi();
  api.list
    .mockResolvedValueOnce({ items: [deckRows[0]!], total: 1 })
    .mockResolvedValue({ items: [], total: 0 });
  api.command.mockResolvedValue({ id: "A" });
  shell.value = shellValue(api, { media: { finishing: Finishing } });
});
afterEach(() => {
  jest.restoreAllMocks();
});

test("normal motion plays the product's finish inside the end and its end leaves the same counts", async () => {
  await reach(false);
  const end = within(screen.getByTestId("deck-end"));
  expect(end.getByTestId("finishing-renderer")).toBeTruthy();
  expect(drawn.at(-1)).toMatchObject({ tone: "ok", motion: "normal" });
  const counts = screen.getByTestId("deck-end").props.accessibilityLabel;
  await fireEvent.press(screen.getByTestId("finishing-renderer"));
  await waitFor(() => expect(screen.queryByTestId("finishing-renderer")).toBeNull());
  expect(within(screen.getByTestId("deck-end")).getByText(words.caughtUp)).toBeTruthy();
  expect(screen.getByTestId("deck-end").props.accessibilityLabel).toBe(counts);
  expect(api.command).toHaveBeenCalledTimes(1);
});

test("reduced motion shows the end with no finish and turning motion on does not play it late", async () => {
  await reach(true);
  expect(screen.queryByTestId("finishing-renderer")).toBeNull();
  expect(motionListeners.length).toBeGreaterThan(0);
  await act(async () => motionListeners.forEach((changed) => changed(false)));
  expect(within(screen.getByTestId("deck-end")).getByText(words.caughtUp)).toBeTruthy();
  expect(screen.queryByTestId("finishing-renderer")).toBeNull();
  expect(drawn).toHaveLength(0);
});
