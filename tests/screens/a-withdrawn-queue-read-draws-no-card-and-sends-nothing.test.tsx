// A queue read the server withdraws (signed out, off the plan, no access, gone) leaves the deck
// screen holding nothing it read: no card, no progress, no end counts and no retry — only the
// refusal and the way back — whether the read failed while loading or while checking for more.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { ResourceDeck } from "../../src/screens/ResourceDeck";
import { failureSubject } from "../../src/core/derive";
import { ApiError } from "../../src/effects/api";
import { refusalOf } from "../../src/screens/failure";
import { feedback } from "../fakes/presentation";
import { fakeApi, shell, shellValue } from "../fakes/shell";
import { deckEntryFixture, deckRows } from "../fakes/deck";
import { reset } from "../fakes/router";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const entry = deckEntryFixture();
let api: ReturnType<typeof fakeApi>;
beforeEach(() => {
  reset();
  jest.clearAllMocks();
  api = fakeApi();
  shell.value = shellValue(api);
});

const enabled = () =>
  screen
    .queryAllByRole("button")
    .filter((b) => b.props.accessibilityState?.disabled !== true)
    .map((b) => b.props.testID ?? b.props.accessibilityLabel);

async function expectWithdrawn(status: number, reads: number) {
  const said = refusalOf(
    new ApiError(status, "private"),
    "read",
    failureSubject(entry),
    feedback.copy,
  );
  await waitFor(() => expect(screen.getByTestId("deck-notice")).toBeTruthy());
  await act(async () => undefined);
  expect(said.text).not.toBe("");
  expect(screen.getByText(said.text)).toBeTruthy();
  expect(screen.queryByText(feedback.copy.state.retry)).toBeNull();
  expect(screen.queryByTestId("deck-card")).toBeNull();
  expect(screen.queryByTestId("deck-progress")).toBeNull();
  expect(screen.queryByTestId("deck-end")).toBeNull();
  expect(enabled()).toEqual(["deck-back"]);
  for (const id of ["deck-left", "deck-down", "deck-right", "deck-rewind"]) {
    const control = screen.queryByTestId(id);
    if (control) await fireEvent.press(control);
  }
  await act(async () => undefined);
  expect(api.command).not.toHaveBeenCalled();
  expect(api.list).toHaveBeenCalledTimes(reads);
}

test.each([401, 402, 403, 404])(
  "a queue read answered %i while loading draws no card and offers only the way back",
  async (status) => {
    api.list.mockRejectedValue(new ApiError(status, "private"));
    await render(<ResourceDeck entry={entry} />);
    await expectWithdrawn(status, 1);
  },
);

test.each([401, 402, 403, 404])(
  "a final count answered %i takes away the pass it held and claims no end",
  async (status) => {
    api.list
      .mockResolvedValueOnce({ items: deckRows, total: deckRows.length })
      .mockRejectedValue(new ApiError(status, "private"));
    await render(<ResourceDeck entry={entry} />);
    for (const row of deckRows) {
      await waitFor(() =>
        expect(screen.getByTestId("deck-card").props.accessibilityLabel).toContain(row.title),
      );
      await waitFor(() => expect(screen.getByTestId("deck-down")).not.toBeDisabled());
      await fireEvent.press(screen.getByTestId("deck-down"));
    }
    await expectWithdrawn(status, 2);
  },
);
