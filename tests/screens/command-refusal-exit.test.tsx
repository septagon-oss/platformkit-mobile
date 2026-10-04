import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { ResourceRoute } from "../../src/route";
import { reset, router, setParams } from "../fakes/router";
import { fakeApi, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));

beforeEach(() => {
  reset();
  shell.value = shellValue(fakeApi());
  setParams({ module: "note", entity: "note", verb: "publish" });
});

test("closing a command refusal returns to the preceding screen when there is one", async () => {
  await render(<ResourceRoute kind="command" withVerb />);
  expect(screen.getByRole("alert")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  expect(router.back).toHaveBeenCalledTimes(1);
});

test("closing a command refusal opened without history returns to its resource list", async () => {
  router.canGoBack.mockReturnValue(false);
  await render(<ResourceRoute kind="command" withVerb />);
  expect(screen.getByRole("alert")).toBeOnTheScreen();
  expect(screen.queryByTestId("resource-form")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  expect(router.replace).toHaveBeenCalledWith("/note/note");
  expect(router.back).not.toHaveBeenCalled();
});
