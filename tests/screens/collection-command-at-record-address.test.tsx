import { beforeEach, expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { ResourceRoute } from "../../src/route";
import { reset, setParams } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));

// The two refusals are one rule read from each side. The review's test shows a
// command about one record refused at the collection's address; this one shows a
// command about the collection refused at a record's, where the row in the path
// would be sent to a door that takes none — and shows that scoping the verb by
// address costs the sheet its own kind does have, so the rule is not a screen
// that refuses everything with a word it does not recognise.

const archive = note.commands.find((c) => c.verb === "archive")!;

beforeEach(() => {
  reset();
  shell.value = shellValue(fakeApi());
});

test("the fixture's archive is a command about the collection", () => {
  expect(archive.collection).toBe(true);
});

test("a collection command at the collection's address is a sheet", async () => {
  setParams({ module: "note", entity: "note", verb: "archive" });
  await render(<ResourceRoute kind="command" withVerb />);
  expect(await screen.findByTestId("resource-form")).toBeOnTheScreen();
});

test("a collection command opened at a record's address is refused, not offered", async () => {
  setParams({ module: "note", entity: "note", id: "42", verb: "archive" });
  await render(<ResourceRoute kind="command" withID withVerb />);
  expect(screen.getByRole("alert")).toBeOnTheScreen();
  expect(screen.queryByTestId("resource-form")).toBeNull();
});
