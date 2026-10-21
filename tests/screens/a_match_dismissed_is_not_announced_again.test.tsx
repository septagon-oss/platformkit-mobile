// A match is announced once: the person who dismisses "It's a match!" and keeps voting is not shown
// the same match again when the next read still holds it.

import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import type { Entry } from "../../src/core/catalog";
import { VoteDeck } from "../../src/packs/decide/vote";
import { reset } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => ({
  ...require("../fakes/router").expoRouter,
  useLocalSearchParams: () => ({ question: "q1" }),
}));
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/core/deck", () => ({ reviewDeck: () => ({ queue: [] }) }));
jest.mock("../../src/screens/ResourceDeck", () => {
  const { View, Pressable } = require("react-native");
  return {
    DeckSession: ({ header, receipt }: any) => (
      <View>
        {header}
        <Pressable testID="vote" onPress={() => receipt.onAccepted()} />
      </View>
    ),
  };
});

const api = fakeApi();
const entry: Entry = { ...note, module: "decide", entity: "card" };
const tally = (matched: boolean) => ({
  questionId: "q1",
  questionRevision: 1,
  observedAt: "2026-05-02T10:00:00Z",
  acceptingVotes: true,
  options: [
    {
      option: { id: "c", title: "Riverside", position: 1 },
      score: 1,
      counts: { yes: 2, strong: 0, no: 0, skip: 0 },
      voters: { yes: ["u1", "u2"], strong: [], no: [], skip: [] },
      matched,
    },
  ],
});

beforeEach(() => {
  reset();
  api.request.mockReset();
  shell.value = shellValue(api);
});

describe("the match moment", () => {
  test("a match the person dismissed does not come back on the next read", async () => {
    let answer = tally(false);
    api.request.mockImplementation(async (_m, _p, validate) => validate(answer));
    const view = await render(<VoteDeck entry={entry} />);
    const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
    await settle();
    answer = tally(true);
    fireEvent.press(view.getByTestId("vote"));
    await waitFor(() => expect(view.queryByTestId("decide-match")).not.toBeNull());
    fireEvent.press(view.getByTestId("decide-match-results"));
    await settle();
    expect(view.queryByTestId("decide-match")).toBeNull();
    fireEvent.press(view.getByTestId("vote"));
    await settle();
    await settle();
    expect(view.queryByTestId("decide-match")).toBeNull();
  });
});
