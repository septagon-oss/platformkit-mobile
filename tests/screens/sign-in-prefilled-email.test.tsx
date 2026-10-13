// Returning to a refused session asks for the password, with the email already
// shown. Both submission controls must send that shown address even when the
// person never edits it; changing it must still submit the new address.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { SignIn } from "../../src/screens/SignIn";
import { ThemeProvider } from "../../src/ui/theme";
import { reset } from "../fakes/router";
import { fakeApi, shell, shellValue } from "../fakes/shell";

jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);

const email = "returning@example.test";
const baseURL = "https://workspace.example.test";
const password = "the right password";

beforeEach(() => {
  reset();
  shell.value = shellValue(fakeApi(), {
    baseURL,
    state: { phase: "anonymous", generation: 2, reason: "expired" },
    returning: { href: "/note/note", who: `${baseURL}|member`, email },
    signIn: jest.fn(async () => ({ kind: "signed-in" as const })),
  });
});

async function enterPassword() {
  await render(
    <ThemeProvider mode="light">
      <SignIn />
    </ThemeProvider>,
  );
  expect(screen.getByTestId("email")).toHaveProp("value", email);
  await fireEvent.changeText(screen.getByTestId("password"), password);
}

test("tapping Sign in submits the prefilled email without editing it", async () => {
  await enterPassword();
  await fireEvent.press(screen.getByTestId("submit"));
  await waitFor(() => expect(shell.value!.signIn).toHaveBeenCalledTimes(1));
  expect(shell.value!.signIn).toHaveBeenCalledWith(baseURL, email, password);
});

test("the password keyboard submits the prefilled email without editing it", async () => {
  await enterPassword();
  await fireEvent(screen.getByTestId("password"), "submitEditing");
  await waitFor(() => expect(shell.value!.signIn).toHaveBeenCalledTimes(1));
  expect(shell.value!.signIn).toHaveBeenCalledWith(baseURL, email, password);
});

test("editing a prefilled email submits the replacement address", async () => {
  await enterPassword();
  await fireEvent.changeText(screen.getByTestId("email"), "another@example.test");
  await fireEvent.press(screen.getByTestId("submit"));
  await waitFor(() => expect(shell.value!.signIn).toHaveBeenCalledTimes(1));
  expect(shell.value!.signIn).toHaveBeenCalledWith(baseURL, "another@example.test", password);
});
