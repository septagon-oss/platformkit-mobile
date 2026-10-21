// A deck choice the phone held ends its session when the outbox resolves the write, and the
// deck's contract (docs/review-deck.md, the held row) is "closed / restart offered": the person
// is offered a new pass that reads the queue again, never left with every control disabled.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { ResourceDeck } from "../../src/screens/ResourceDeck";
import { heldWrite } from "../../src/core/outbox";
import { commandPath } from "../../src/core/derive";
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
  api.list.mockResolvedValue({ items: deckRows, total: 3 });
});

// The controls a pass always draws; anything else enabled on the screen is an offer to go on.
const fixed = new Set(["deck-back", "deck-card", "deck-left", "deck-down", "deck-right"]);

test("a held choice the outbox later sends offers a new pass that reads the queue again", async () => {
  const item = heldWrite(
    {
      kind: "command",
      resourceKey: `${entry.module}/${entry.entity}`,
      path: commandPath(entry, "accept", "A"),
    },
    "00000000-0000-4000-8000-000000000091",
    feedback.now,
  );
  const outbox = {
    items: [] as (typeof item)[],
    submit: async () => ({ sent: false as const, item }),
    retry: async () => undefined,
    discard: async () => undefined,
    drain: async () => undefined,
  };
  shell.value = shellValue(api, { outbox });
  const view = await render(<ResourceDeck entry={entry} />);
  await waitFor(() => expect(screen.getByTestId("deck-right")).not.toBeDisabled());
  await fireEvent.press(screen.getByTestId("deck-right"));
  // The phone holds the choice: the card stays with the holding sentence and nothing is sent.
  await waitFor(() =>
    expect(
      screen.getByText(feedback.copy.state.holding(feedback.copy.state.held.title)),
    ).toBeTruthy(),
  );
  expect(api.command).not.toHaveBeenCalled();

  // The outbox lists the hold, then sends it: A has left the server's queue.
  shell.value = { ...shell.value!, outbox: { ...outbox, items: [item] } };
  await view.rerender(<ResourceDeck entry={entry} />);
  api.list.mockResolvedValue({ items: deckRows.slice(1), total: 2 });
  shell.value = { ...shell.value!, outbox: { ...outbox, items: [] } };
  await view.rerender(<ResourceDeck entry={entry} />);
  await act(async () => undefined);

  if (!screen.queryByTestId("deck-card")) {
    const offers = screen
      .queryAllByRole("button")
      .filter((b) => !fixed.has(b.props.testID) && b.props.accessibilityState?.disabled !== true);
    expect(offers.map((b) => b.props.testID ?? b.props.accessibilityLabel)).not.toEqual([]);
    await fireEvent.press(offers[0]!);
  }
  await waitFor(() =>
    expect(screen.getByTestId("deck-card").props.accessibilityLabel).toContain("Birch"),
  );
  expect(screen.getByTestId("deck-down")).not.toBeDisabled();
  expect(api.command).not.toHaveBeenCalled();
});
