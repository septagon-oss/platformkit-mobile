// A match moment interrupts once per match: what the deck found before this person sat down is not
// news to them, and a match they have already answered to does not come back — but the next one still does.

import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
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

/** row is one option of the ranking, a match only when the test names it. */
const row = (id: string, title: string, matched: boolean) => ({
  option: { id, title, position: 1 },
  score: 1,
  counts: { yes: 2, strong: 0, no: 0, skip: 0 },
  voters: { yes: ["u1", "u2"], strong: [], no: [], skip: [] },
  matched,
});

/** tally is the ranking a read answers with, the named options marked as matches. */
const tally = (...matched: string[]) => ({
  questionId: "q1",
  questionRevision: 1,
  observedAt: "2026-05-02T10:00:00Z",
  acceptingVotes: true,
  options: [
    row("c", "Riverside", matched.includes("c")),
    row("d", "Harbour", matched.includes("d")),
  ],
});

/** answer is what the next read holds; a test changes it to stand for the ballots in between. */
let answer: unknown = tally();

/** resultReads counts the rankings the deck asked for, which is how a test says a read has landed. */
const resultReads = () =>
  api.request.mock.calls.filter(([method, path]) => method === "GET" && /\/results$/.test(path))
    .length;

beforeEach(() => {
  reset();
  api.request.mockReset();
  api.request.mockImplementation(async (_m, _p, validate) => validate(answer));
  shell.value = shellValue(api);
});

/**
 * vote answers with the deck's receipt, which makes the screen read the ranking again, and waits
 * for that read to be asked for. The answer it lands with is whatever `answer` holds by then.
 */
async function vote(view: Awaited<ReturnType<typeof render>>) {
  const asked = resultReads();
  fireEvent.press(view.getByTestId("vote"));
  await waitFor(() => expect(resultReads()).toBeGreaterThan(asked));
}

describe("the match moment", () => {
  test("a match the deck found before this person opened it is never announced to them", async () => {
    answer = tally("c");
    const view = await render(<VoteDeck entry={entry} />);
    await waitFor(() => expect(resultReads()).toBeGreaterThan(0));
    await vote(view);
    expect(view.queryByTestId("decide-match")).toBeNull();
  });

  test("the match after a dismissed one is announced, and it names the option that is new", async () => {
    answer = tally();
    const view = await render(<VoteDeck entry={entry} />);
    await waitFor(() => expect(resultReads()).toBeGreaterThan(0));
    answer = tally("c");
    await vote(view);
    await waitFor(() => expect(view.queryByTestId("decide-match")).not.toBeNull());
    fireEvent.press(view.getByTestId("decide-match-results"));
    await waitFor(() => expect(view.queryByTestId("decide-match")).toBeNull());
    // Riverside still holds its match; only Harbour arriving opens the moment a second time.
    answer = tally("c", "d");
    await vote(view);
    await waitFor(() => expect(view.queryByTestId("decide-match")).not.toBeNull());
    const moment = view.getByTestId("decide-match");
    expect(within(moment).queryByText("Harbour")).not.toBeNull();
    expect(within(moment).queryByText("Riverside")).toBeNull();
  });
});
