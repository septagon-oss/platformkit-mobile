import { beforeEach, expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { ResourceRoute } from "../../src/route";
import { reset, setParams } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));

// A command is about one record or about the collection (src/core/catalog.ts:
// "{entry.path}/{id}/{verb}, or {entry.path}/{verb} when collection"). The
// collection's address, app/[module]/[entity]/run/[verb].tsx, has no row to
// send, so a record command opened there would POST to an address the server
// never mounted. It is refused on the screen, as an unknown verb is, and not
// offered as a sheet a person can fill in and run.

const publish = note.commands.find((c) => c.verb === "publish")!;

beforeEach(() => {
  reset();
  shell.value = shellValue(fakeApi());
});

test("the fixture's publish is a record command that takes an argument", () => {
  expect(publish.collection).not.toBe(true);
  expect(publish.fields.length).toBeGreaterThan(0);
});

test("a record command at its record's address is a sheet", async () => {
  setParams({ module: "note", entity: "note", id: "42", verb: "publish" });
  await render(<ResourceRoute kind="command" withID withVerb />);
  expect(await screen.findByTestId("resource-form")).toBeOnTheScreen();
});

test("a record command opened at the collection's address is refused, not offered", async () => {
  setParams({ module: "note", entity: "note", verb: "publish" });
  await render(<ResourceRoute kind="command" withVerb />);
  expect(screen.getByRole("alert")).toBeOnTheScreen();
  expect(screen.queryByTestId("resource-form")).toBeNull();
});
