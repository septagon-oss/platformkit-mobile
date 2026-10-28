// The sheet a stepped entry opens draws one step at a time: the rail in the server's words,
// the progress line, only the step's own boxes, and the step's own verb as the way on. The
// header keeps Cancel and offers no Save, because the write's door is the last step's verb.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { type Catalog, type Entry, parseCatalog } from "../../src/core/catalog";
import { ResourceForm } from "../../src/screens/ResourceForm";
import { ThemeProvider } from "../../src/ui/theme";
import { header, reset } from "../fakes/router";
import { fakeApi, shell, shellValue } from "../fakes/shell";
import { steppedNote } from "../fakes/steps";

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
 * stepped is the kernel's note record with the kernel's three-step create form resolved on it
 * (`tests/fakes/steps.ts`), read through this phone's own catalogue door.
 */
const stepped = (): { readonly entry: Entry; readonly catalog: Catalog } => {
  const catalog = parseCatalog(steppedNote(), () => {});
  return { entry: catalog.resources[0]!, catalog };
};

test("a stepped sheet draws the step it stands on, and the header names no Save", async () => {
  const api = fakeApi();
  // The catalogue the shell holds is the stepped one: the sheet reads its steps off the
  // entry, and the shell reads the entry's availability off the catalogue it holds.
  const { entry, catalog } = stepped();
  shell.value = shellValue(api, {
    entry: () => entry,
    state: { phase: "ready", generation: 1, catalog },
  });
  await render(
    <ThemeProvider mode="light">
      <ResourceForm entry={entry} />
    </ThemeProvider>,
  );
  // The rail is the server's: three steps, in the server's order and words, with the
  // progress line the stepper draws for itself, and one step's boxes on the screen — the
  // title is asked for here, the body and the tags are another step's to ask.
  await waitFor(() => expect(screen.getByText("Step 1 of 3")).toBeOnTheScreen());
  // Each stage wears the server's label with the state the phone derives under it, and the
  // block on the screen is the step's own, headed by the same server's label.
  expect(screen.getByRole("button", { name: "Details · Required" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Description · Optional" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Options · Optional" })).toBeOnTheScreen();
  // Twice, once on the stage and once as the heading of the block it opens.
  expect(screen.getAllByText("Details")).toHaveLength(2);
  expect(screen.getByTestId("input-title")).toBeOnTheScreen();
  expect(screen.queryByTestId("input-body")).toBeNull();
  expect(screen.queryByTestId("input-tags")).toBeNull();
  // The way on wears the step's own verb and the answer it still wants; the way back is
  // disabled, because there is no step behind the first one.
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Enter a title" })).toBeOnTheScreen(),
  );
  expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  // The header holds the exit and no write: the sheet's door is the step's verb.
  expect(header.options).toBeDefined();
  expect(header.options?.headerLeft).toBeDefined();
  expect(header.options?.headerRight).toBeUndefined();
  expect(api.create).not.toHaveBeenCalled();
});

test("the sheet refuses onward where the step owes an answer, and opens on the answer given", async () => {
  const api = fakeApi();
  // The catalogue the shell holds is the stepped one: the sheet reads its steps off the
  // entry, and the shell reads the entry's availability off the catalogue it holds.
  const { entry, catalog } = stepped();
  shell.value = shellValue(api, {
    entry: () => entry,
    state: { phase: "ready", generation: 1, catalog },
  });
  await render(
    <ThemeProvider mode="light">
      <ResourceForm entry={entry} />
    </ThemeProvider>,
  );
  const on = await waitFor(() => screen.getByRole("button", { name: "Enter a title" }));
  await fireEvent.press(on);
  await waitFor(() => expect(screen.getByText("Review the highlighted fields.")).toBeOnTheScreen());
  // Nobody moved and nothing was sent: the step's boxes are still the ones on the screen.
  expect(screen.getByTestId("input-title")).toBeOnTheScreen();
  expect(screen.queryByTestId("input-body")).toBeNull();
  expect(api.create).not.toHaveBeenCalled();

  await fireEvent(screen.getByTestId("input-title"), "onChangeText", "Autumn notes");
  // The verb says what the press will do with the answer in hand.
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Next · Autumn notes" })).toBeOnTheScreen(),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Next · Autumn notes" }));
  await waitFor(() => expect(screen.getByText("Step 2 of 3")).toBeOnTheScreen());
  expect(screen.getByTestId("input-body")).toBeOnTheScreen();
  expect(screen.queryByTestId("input-title")).toBeNull();
  expect(api.create).not.toHaveBeenCalled();
  // The step behind is complete, and the way back asks nothing.
  expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await waitFor(() => expect(screen.getByText("Step 1 of 3")).toBeOnTheScreen());
  expect(screen.getByTestId("input-title")).toHaveProp("value", "Autumn notes");
});
