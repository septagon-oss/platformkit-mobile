// A stepped sheet keeps one door that writes for a reason the step label never decides.
// A refusal sentence the stepper may not print refuses the walk's model, and the sheet a
// model-less walk falls back to is the flat sheet: every box, and a header that can write.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { parseCatalog, type Catalog, type Entry } from "../../src/core/catalog";
import { ResourceForm } from "../../src/screens/ResourceForm";
import { ThemeProvider } from "../../src/ui/theme";
import { ApiError } from "../../src/effects/api";
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

/** The kernel's own stepped capture: the note's update form, one step, all five editable fields. */
const steppedNote = (): Catalog =>
  parseCatalog(JSON.parse(readFileSync("testdata/catalog.deck.json", "utf8").toString()), () => {});

/** Every box the sheet draws, and the one door that files what the person typed. */
const doors = () => [
  ...screen.queryAllByTestId("save"),
  ...screen.queryAllByRole("button", { name: "Save the note" }),
];

test("a refusal sentence the stepper may not print leaves the sheet every box and one door", async () => {
  const api = fakeApi();
  api.get.mockResolvedValue({ id: "note-7", title: "Water the fig" });
  // The transport keeps a detail the server printed with spaces for words, and the stepper
  // will not print a stage sentence with no words in it: the walk's model is refused.
  api.update.mockRejectedValueOnce(
    new ApiError(422, "the note is not complete", {
      title: "   ",
    }),
  );
  const catalog = steppedNote();
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
  // The step's own verb is the door while the rail draws.
  expect(doors()).toHaveLength(1);
  await fireEvent.press(doors()[0]!);
  await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
  // The refusal reached the field it named and the sheet fell back to the scroll the entry
  // always asked for: the boxes are still all there, and the door is now the header's Save.
  expect(screen.getByTestId("input-body")).toBeOnTheScreen();
  await waitFor(() => expect(screen.getByTestId("save")).toBeOnTheScreen());
  expect(doors()).toHaveLength(1);
  await fireEvent.press(screen.getByTestId("save"));
  await waitFor(() => expect(api.update).toHaveBeenCalledTimes(2));
  expect(api.update.mock.calls[1]![2]).toMatchObject({ body: "Fig, north wall" });
  expect(api.update.mock.calls[1]![2]).toMatchObject({ title: expect.any(String) });
});
