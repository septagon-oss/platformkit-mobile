// A Decide result is the ranking the module made, not one the phone remade. Three rules, each of
// which a screen could silently break: the options appear in the order the read gave them (score
// order, tie-break and all, so the phone never ranks a second time); the number beside a bar is the
// bar's own model's number, so the two cannot disagree; and the weighted score stays inside the
// module — a person reads a count of voters, never an arithmetic weight. A door that is not on the
// entry is drawn nowhere: the close command belongs to whoever the catalogue printed it for.

import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";
import type { Entry } from "../../src/core/catalog";
import { QuestionResults } from "../../src/packs/decide/results";
import { reset } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const api = fakeApi();

/** questions is the entry as the catalogue would print it: read-only, closed only by a command. */
const questions: Entry = {
  ...note,
  module: "decide",
  entity: "questions",
  path: "/api/v1/decide/questions",
  writable: true,
  operations: ["list", "read"],
};

const standing = {
  questionId: "q1",
  questionRevision: 3,
  options: [
    {
      option: { id: "c", title: "Riverside", position: 1 },
      score: 77,
      counts: { yes: 2, strong: 0, no: 0, skip: 1 },
      voters: { yes: ["u1", "u2"], strong: [], no: [], skip: ["u3"] },
    },
    {
      option: { id: "d", title: "Old Mill", position: 2 },
      score: 41,
      counts: { yes: 1, strong: 0, no: 0, skip: 0 },
      voters: { yes: ["u4"], strong: [], no: [], skip: [] },
    },
  ],
  tallyVersion: 2,
  acceptingVotes: true,
  observedAt: "2026-05-02T10:00:00Z",
};

const row = { id: "q1", title: "Where should we meet?", status: "open", revision: 3 };

async function opened(entry: Entry) {
  api.get.mockResolvedValue(row);
  api.request.mockImplementation(async (_method, path, validate) =>
    path.endsWith("/results") ? validate(standing) : validate(undefined),
  );
  const view = render(<QuestionResults entry={entry} id="q1" />);
  await act(async () => {
    await new Promise((settle) => setTimeout(settle, 0));
  });
  return view;
}

beforeEach(() => {
  reset();
  api.get.mockReset();
  api.request.mockReset();
  shell.value = shellValue(api);
});

describe("the result as the module ranked it", () => {
  test("the options stand in the order the read gave them, with the tally beside each", async () => {
    const { getAllByTestId } = await opened(questions);
    await waitFor(() => expect(getAllByTestId("decide-option-row")).toHaveLength(2));
    const titles = getAllByTestId("decide-option-row").map((r) => JSON.stringify(r.children));
    expect(titles[0]).toContain("Riverside");
    expect(titles[1]).toContain("Old Mill");
    // Four ballots were cast — two for Riverside, one for Old Mill, one skipped — so the leader
    // stands on a half of them, and the figure beside a bar is that meter's own text: whatever the
    // bar says it filled is the number printed beside it, so the two cannot part company.
    expect(titles[0]).toContain("50%");
    expect(titles[1]).toContain("25%");
    expect(titles[0]).toContain('"aria-valuenow\":2');
    // 77 and 41 are weighted scores: the arithmetic that put Riverside first. A person is told how
    // many voted — 2 and 1 here — and never the weights, which are the module's own ordering rule.
    expect(titles.join("")).not.toContain("77");
    expect(titles.join("")).not.toContain("41");
  });

  test("a question whose entry prints no close command is offered no close", async () => {
    const { queryByTestId } = await opened({ ...questions, commands: [] });
    expect(queryByTestId("decide-close")).toBeNull();
  });
});
