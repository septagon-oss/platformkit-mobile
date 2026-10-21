// The deck's two doors are routes `reentry` spells: the list's queue button opens the deck at
// `address("deck", …)`, and a card the person taps opens its record at `rowAt`, the one spelling
// of a row's route, so an id that needs encoding reaches the same record a list row opens.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { address, rowAt } from "../../src/core/reentry";
import { ResourceDeck } from "../../src/screens/ResourceDeck";
import { ResourceList } from "../../src/screens/ResourceList";
import { deckEntryFixture } from "../fakes/deck";
import { reset, router } from "../fakes/router";
import { fakeApi, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const entry = deckEntryFixture();
const awkward = { id: "a/b c?#%", title: "Apple", status: "open", rank: 4 };
let api: ReturnType<typeof fakeApi>;

beforeEach(() => {
  reset();
  jest.clearAllMocks();
  api = fakeApi();
  api.list.mockResolvedValue({ items: [awkward], total: 1 });
  shell.value = shellValue(api);
});

test("the list's queue button opens the deck at the address reentry spells for it", async () => {
  await render(<ResourceList entry={entry} />);
  await waitFor(() => expect(screen.getByTestId("review-queue")).not.toBeDisabled());
  await fireEvent.press(screen.getByTestId("review-queue"));
  expect(router.push).toHaveBeenLastCalledWith(address("deck", entry));
});

test("a tapped card opens its record at the row route a list row opens", async () => {
  await render(<ResourceDeck entry={entry} />);
  await waitFor(() => expect(screen.getByTestId("deck-right")).not.toBeDisabled());
  await fireEvent.press(screen.getByTestId("deck-card"));
  expect(router.push).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenLastCalledWith(rowAt(entry.module, entry.entity, awkward.id));
  expect(api.command).not.toHaveBeenCalled();
});
