// When the outbox resolves a held deck choice, the deck closes and its Refresh starts a new pass
// (docs/review-deck.md, the held row). Disappearance is not acceptance: the new pass reads the
// queue from the server, counts only the choices made in it, and sends its own command once.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { ResourceDeck } from "../../src/screens/ResourceDeck";
import { heldWrite, type PendingWrite } from "../../src/core/outbox";
import { commandPath } from "../../src/core/derive";
import { confirm } from "../../src/ui/chooser";
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

test("a pass restarted after a held choice resolves counts only its own choices and sends its command once", async () => {
  const item = heldWrite(
    {
      kind: "command",
      resourceKey: `${entry.module}/${entry.entity}`,
      path: commandPath(entry, "accept", "A"),
    },
    "00000000-0000-4000-8000-000000000391",
    feedback.now,
  );
  // The first submission is held (the phone is offline); every later one reaches the server.
  let offline = true;
  const key = "00000000-0000-4000-8000-000000000392";
  const outbox = {
    items: [] as PendingWrite[],
    submit: async <T,>(_w: unknown, live?: (key: string) => Promise<T>) => {
      if (offline || !live) {
        offline = false;
        return { sent: false as const, item };
      }
      return { sent: true as const, row: await live(key) };
    },
    retry: async () => undefined,
    discard: async () => undefined,
    drain: async () => undefined,
  };
  shell.value = shellValue(api, { outbox });
  const view = await render(<ResourceDeck entry={entry} />);
  // Archive asks first and the person cancels; then Accept is held. A restarted pass that reused
  // the first pass's step numbers would reach its own Accept at the held one's number.
  await waitFor(() => expect(screen.getByTestId("deck-left")).not.toBeDisabled());
  await fireEvent.press(screen.getByTestId("deck-left"));
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  await act(async () => jest.mocked(confirm).mock.calls[0]![3]?.onCancel?.());
  await waitFor(() => expect(screen.getByTestId("deck-right")).not.toBeDisabled());
  await fireEvent.press(screen.getByTestId("deck-right"));
  await waitFor(() =>
    expect(
      screen.getByText(feedback.copy.state.holding(feedback.copy.state.held.title)),
    ).toBeTruthy(),
  );

  // The outbox lists the hold and then sends it: A has left the server's queue, B remains.
  shell.value = { ...shell.value!, outbox: { ...outbox, items: [item] } };
  await view.rerender(<ResourceDeck entry={entry} />);
  shell.value = { ...shell.value!, outbox: { ...outbox, items: [] } };
  await view.rerender(<ResourceDeck entry={entry} />);
  await waitFor(() => expect(screen.getByTestId("deck-refresh")).not.toBeDisabled());

  api.list.mockResolvedValueOnce({ items: [deckRows[1]!], total: 1 });
  api.list.mockResolvedValue({ items: [], total: 0 });
  await fireEvent.press(screen.getByTestId("deck-refresh"));
  await waitFor(() =>
    expect(screen.getByTestId("deck-card").props.accessibilityLabel).toContain("Birch"),
  );
  const meter = screen.getByTestId("deck-progress").props;
  expect([meter["aria-valuenow"], meter["aria-valuemax"]]).toEqual([0, 1]);

  await waitFor(() => expect(screen.getByTestId("deck-right")).not.toBeDisabled());
  await fireEvent.press(screen.getByTestId("deck-right"));
  await waitFor(() =>
    expect(api.command).toHaveBeenCalledWith(entry, "B", "accept", undefined, {
      idempotencyKey: key,
    }),
  );
  await waitFor(() => expect(screen.getByTestId("deck-end")).toBeTruthy());
  expect(api.command).toHaveBeenCalledTimes(1);
  expect(shell.value!.wrote).toHaveBeenCalledTimes(1);
  const accept = entry.hints!.deck!.directions.right!;
  const label = "label" in accept ? accept.label : "";
  const end = screen.getByTestId("deck-end").props.accessibilityLabel as string;
  expect(end).toContain(feedback.copy.review.caughtUp);
  expect(end).toContain(`${label}: 1`);
  const done = screen.getByTestId("deck-progress").props;
  expect([done["aria-valuenow"], done["aria-valuemax"]]).toEqual([1, 1]);
});
