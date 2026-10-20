// The notification question is one block on the page: the sentence the copy table owns, the
// one primary answer that opens the platform's prompt, and a secondary that spends the offer.
// Which of those states the phone is in is the shell's decision (`push`), so what a screen
// draws follows it exactly — including the states where nothing may be pressed at all.
import { expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import type { ShellValue } from "../../src/shell";
import { PushInvite } from "../../src/screens/PushInvite";
import { fakeApi, shell, shellValue } from "../fakes/shell";

jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));

/** asked is the shell's `push` member, drawn as the person standing there would see it. */
async function asked(push: ShellValue["push"]): Promise<void> {
  shell.value = shellValue(fakeApi(), { push });
  await render(<PushInvite />);
}

const answers = (): ShellValue["push"] => ({
  status: "unasked",
  offer: true,
  decline: jest.fn<ShellValue["push"]["decline"]>(),
  turnOn: jest.fn<ShellValue["push"]["turnOn"]>(async () => undefined),
});

test("the offer is one sentence and the two answers that person has", async () => {
  await asked(answers());
  expect(screen.getByTestId("push-invite")).toBeTruthy();
  expect(screen.getByTestId("push-turn-on")).toBeTruthy();
  expect(screen.getByTestId("push-not-now")).toBeTruthy();
  expect(screen.queryByTestId("push-refused")).toBeNull();
});

test("an offer that is not on is drawn nowhere, and so is a phone that is already reachable", async () => {
  for (const status of ["off", "unasked", "registered"] as const) {
    await asked({ ...answers(), status, offer: false });
    expect(screen.queryByTestId("push-invite")).toBeNull();
    expect(screen.queryByTestId("push-refused")).toBeNull();
  }
});

test("an address this phone could not get is said, with nothing to press", async () => {
  for (const status of ["refused", "unreachable"] as const) {
    await asked({ ...answers(), status, offer: false });
    expect(screen.getByTestId("push-refused")).toBeTruthy();
    expect(screen.queryByTestId("push-turn-on")).toBeNull();
    expect(screen.queryByTestId("push-not-now")).toBeNull();
  }
});
