// An editable richtext field offers the shared keyboard formatting toolbar and
// image insertion. Opening the form alone does not issue a write or an upload.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import type { Entry } from "../../src/core/catalog";
import { ResourceForm } from "../../src/screens/ResourceForm";
import { ThemeProvider } from "../../src/ui/theme";
import { reset } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock(
  "expo-router",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").expoRouter,
);
jest.mock(
  "expo-router/react-navigation",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").reactNavigation,
);
jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));

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

test("an editable richtext form exposes bold and image controls after reading the record", async () => {
  const entry: Entry = {
    ...note,
    fields: note.fields.map((f) => (f.name === "body" ? { ...f, widget: "richtext" } : f)),
  };
  const api = fakeApi();
  api.get.mockResolvedValue({
    id: "note-46",
    title: "Daily care",
    status: "open",
    body: "Give fresh water every morning.",
  });
  shell.value = shellValue(api, { entry: () => entry });
  await render(
    <ThemeProvider mode="light">
      <ResourceForm entry={entry} id="note-46" />
    </ThemeProvider>,
  );
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(entry, "note-46"));
  await waitFor(() => expect(screen.getByTestId("save")).toBeEnabled());
  await fireEvent(screen.getByTestId("input-body"), "focus");
  await waitFor(() => expect(screen.getByRole("button", { name: "Bold" })).toBeOnTheScreen());
  expect(screen.getByRole("button", { name: "Image" })).toBeOnTheScreen();
  expect(api.update).not.toHaveBeenCalled();
});
