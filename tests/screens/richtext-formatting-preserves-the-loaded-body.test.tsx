// Formatting a read value is an edit of that value, even before anyone types into it.
import { beforeEach, expect, jest, test } from "@jest/globals";
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

beforeEach(() => reset());

test("bold on a selected word keeps every other word from the loaded body through Save", async () => {
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
  await waitFor(() => expect(screen.getByTestId("save")).toBeEnabled());
  await fireEvent(screen.getByTestId("input-body"), "selectionChange", {
    nativeEvent: { selection: { start: 5, end: 10 } },
  });
  await fireEvent.press(screen.getByRole("button", { name: "Bold" }));
  await fireEvent.press(screen.getByTestId("save"));
  await waitFor(() => expect(api.update).toHaveBeenCalled());
  expect(api.update).toHaveBeenCalledWith(
    entry,
    "note-46",
    expect.objectContaining({ body: "Give **fresh** water every morning." }),
  );
});
