// A stepped sheet's last step's own verb is the write's door, and the header names no Save.
// Whatever the walk cannot draw, the person still has one door that files what they typed.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { parseCatalog, type Catalog, type Entry } from "../../src/core/catalog";
import { ResourceForm } from "../../src/screens/ResourceForm";
import { ThemeProvider } from "../../src/ui/theme";
import { reset } from "../fakes/router";
import { fakeApi, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));

beforeEach(() => {
  reset();
  const options = Intl.DateTimeFormat().resolvedOptions();
  jest.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    ...options,
    locale: "en-US",
  });
});
afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * The kernel's own stepped capture (`testdata/catalog.deck.json` — one update step asking all
 * five editable fields, wearing "Save the note") with one member made what the contract permits
 * it to be: a step whose label says nothing. `label` is a required `string` with no length rule,
 * so `""` is a legal printing and an all-blank one is what the kernel's own section check
 * (`section.Label == ""`) lets through when an author's hint holds spaces. Either way the sheet
 * draws no heading for the step, which is the organism's ordinary answer to an empty label.
 */
const noteWith = (label: string): Catalog => {
  const doc = JSON.parse(readFileSync("testdata/catalog.deck.json", "utf8").toString());
  const forms = doc.resources[0].resolved as {
    layout: { forms: { updateForm: { steps: { label: string }[] } } };
  };
  forms.layout.forms.updateForm.steps[0]!.label = label;
  return parseCatalog(doc, () => {});
};

/**
 * One door, whichever the walk drew: the header's Save when the sheet is drawn flat, the last
 * step's own verb when the rail drew. A sheet with neither holds what the person typed and has
 * nowhere to put it.
 */
const oneDoorThatWrites = async (label: string): Promise<void> => {
  const api = fakeApi();
  api.get.mockResolvedValue({ id: "note-7", title: "Water the fig" });
  const catalog = noteWith(label);
  const entry = catalog.resources[0] as Entry;
  shell.value = shellValue(api, {
    entry: () => entry,
    state: { phase: "ready", generation: 1, catalog },
  });
  await render(
    <ThemeProvider mode="light">
      <ResourceForm entry={entry} id="note-7" />
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("input-title")).toBeOnTheScreen());
  await fireEvent(screen.getByTestId("input-body"), "onChangeText", "Fig, north wall");
  const doors = [
    ...screen.queryAllByTestId("save"),
    ...screen.queryAllByRole("button", { name: "Save the note" }),
  ];
  expect(doors).toHaveLength(1);
  await fireEvent.press(doors[0]!);
  await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
  expect(api.update.mock.calls[0]![2]).toMatchObject({ body: "Fig, north wall" });
};

test("a stepped sheet whose step names no label still leaves one door that writes", () =>
  oneDoorThatWrites(""));

test("a stepped sheet whose step names a blank label still leaves one door that writes", () =>
  oneDoorThatWrites("  "));

test("the step the sheet draws a heading for keeps that heading, and its verb is the one door", async () => {
  const api = fakeApi();
  api.get.mockResolvedValue({ id: "note-7", title: "Water the fig" });
  const catalog = noteWith("Details");
  const entry = catalog.resources[0] as Entry;
  shell.value = shellValue(api, {
    entry: () => entry,
    state: { phase: "ready", generation: 1, catalog },
  });
  await render(
    <ThemeProvider mode="light">
      <ResourceForm entry={entry} id="note-7" />
    </ThemeProvider>,
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save the note" })).toBeOnTheScreen(),
  );
  expect(screen.queryAllByTestId("save")).toHaveLength(0);
});
