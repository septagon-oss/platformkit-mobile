// A queue read nothing answers (the transport rejected, or the deadline passed with no status) is
// the phone's commonest failure, and it keeps the deck screen open exactly as a server refusal
// the person can retry does: the connection sentence carries a retry, nothing is drawn as a card
// or claimed as the end, and a retry reads the queue again — a first page then draws its first
// card, and a final count that finds nothing says "caught up". No command is sent along the way.
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
const rejected = () => new TypeError("Network request failed");
const deadline = () => new ApiError(0, "crud: timeout after 15000ms: ECONNREFUSED");
let api: ReturnType<typeof fakeApi>;
beforeEach(() => {
  reset();
  jest.clearAllMocks();
  api = fakeApi();
  shell.value = shellValue(api);
});

const retryButton = () => screen.getByRole("button", { name: feedback.copy.state.retry });

async function expectRetryOffered(text: string) {
  await waitFor(() => expect(screen.getByTestId("deck-notice")).toBeTruthy());
  await act(async () => undefined);
  expect(text).not.toBe("");
  expect(screen.getByText(text)).toBeTruthy();
  expect(retryButton()).not.toBeDisabled();
  expect(screen.queryByTestId("deck-card")).toBeNull();
  expect(screen.getByTestId("deck-back")).toBeTruthy();
}

test("a queue read the transport rejects while loading offers retry and a retry that connects draws the first card", async () => {
  api.list
    .mockRejectedValueOnce(rejected())
    .mockResolvedValueOnce({ items: deckRows, total: deckRows.length });
  await render(<ResourceDeck entry={entry} />);
  const said = refusalOf(rejected(), "read", failureSubject(entry), feedback.copy);
  expect(said.verdict.kind).toBe("connection");
  await expectRetryOffered(said.text);
  expect(screen.queryByTestId("deck-progress")).toBeNull();
  expect(screen.queryByTestId("deck-end")).toBeNull();
  expect(api.list).toHaveBeenCalledTimes(1);

  await fireEvent.press(retryButton());
  await waitFor(() =>
    expect(screen.getByTestId("deck-card").props.accessibilityLabel).toContain(deckRows[0]!.title),
  );
  expect(screen.queryByTestId("deck-notice")).toBeNull();
  expect(api.list).toHaveBeenCalledTimes(2);
  expect(api.command).not.toHaveBeenCalled();
});

test("a final count that passes its deadline offers retry and claims no end until a retry finds the queue empty", async () => {
  api.list
    .mockResolvedValueOnce({ items: deckRows, total: deckRows.length })
    .mockRejectedValueOnce(deadline())
    .mockResolvedValueOnce({ items: [], total: 0 });
  await render(<ResourceDeck entry={entry} />);
  for (const row of deckRows) {
    await waitFor(() =>
      expect(screen.getByTestId("deck-card").props.accessibilityLabel).toContain(row.title),
    );
    await waitFor(() => expect(screen.getByTestId("deck-down")).not.toBeDisabled());
    await fireEvent.press(screen.getByTestId("deck-down"));
  }
  expect(refusalOf(deadline(), "read", failureSubject(entry), feedback.copy).verdict.kind).toBe(
    "connection",
  );
  await expectRetryOffered(feedback.copy.review.checkFailed);
  expect(screen.getByTestId("deck-progress")).toBeTruthy();
  expect(screen.queryByText(feedback.copy.review.caughtUp)).toBeNull();
  expect(api.list).toHaveBeenCalledTimes(2);

  await fireEvent.press(retryButton());
  await waitFor(() => expect(screen.getByText(feedback.copy.review.caughtUp)).toBeTruthy());
  expect(screen.getByTestId("deck-end")).toBeTruthy();
  expect(screen.queryByTestId("deck-notice")).toBeNull();
  expect(api.list).toHaveBeenCalledTimes(3);
  expect(api.command).not.toHaveBeenCalled();
});
