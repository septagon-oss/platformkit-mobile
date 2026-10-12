// The sign-in screen has its own way to another server when a sign-in loaded the
// person but not the catalog — a network that dropped half-way through, which is
// the phone this queue was written for. Signing out clears what the phone holds,
// so that door asks first while a write is held, as the home screen's does.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import SignInRoute from "../../app/sign-in";
import { heldWrite } from "../../src/core/outbox";
import type { ShellValue } from "../../src/shell";
import { reset } from "../fakes/router";
import { fakeApi, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));

const held = heldWrite(
  {
    kind: "update",
    resourceKey: "note/note",
    path: "/api/v1/note/notes/4",
    body: { title: "Ward B" },
  },
  "write-4",
  "2026-10-07T08:30:00.000Z",
);

beforeEach(() => {
  reset();
  shell.value = shellValue(fakeApi(), {
    state: { phase: "failed", generation: 3, error: "Network request failed" },
    outbox: {
      items: [held],
      submit: (async () => ({ sent: false as const, item: held })) as NonNullable<
        ShellValue["outbox"]
      >["submit"],
      retry: jest.fn(async () => undefined),
      discard: jest.fn(async () => undefined),
      drain: jest.fn(async () => undefined),
    },
  });
});

test("the sign-in screen's way to another server does not sign out unasked while a write is held", async () => {
  await render(<SignInRoute />);
  await fireEvent.press(screen.getByTestId("sign-in-elsewhere"));
  expect(shell.value!.signOut).not.toHaveBeenCalled();
});
