// Signing out clears what this phone is holding, so every way out asks first
// while a write is held — including the one a catalog that could not be read
// offers, which is exactly the screen a phone that lost its network lands on.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import Index from "../../app/index";
import { heldWrite } from "../../src/core/outbox";
import type { ShellValue } from "../../src/shell";
import { reset } from "../fakes/router";
import { fakeApi, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));

const held = heldWrite(
  { kind: "create", resourceKey: "note/note", path: "/api/v1/note/notes", body: { title: "Kept" } },
  "write-1",
  "2026-10-06T10:00:00.000Z",
);

beforeEach(() => {
  reset();
  shell.value = shellValue(fakeApi(), {
    state: { phase: "failed", generation: 2, error: "Network request failed" },
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

test("leaving for another server while a write is held does not sign out unasked", async () => {
  await render(<Index />);
  await fireEvent.press(screen.getByRole("button", { name: "Sign in to another server" }));
  expect(shell.value!.signOut).not.toHaveBeenCalled();
});
