// A richtext declaration renders its body natively under the catalog's default
// presentation. Choosing it as a record preview must not remove its rich rendering.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import type { Entry } from "../../src/core/catalog";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
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

beforeEach(reset);

test("a default richtext record renders headings and emphasis without a preview override", async () => {
  const entry: Entry = {
    ...note,
    fields: note.fields.map((f) => (f.name === "body" ? { ...f, widget: "richtext" } : f)),
  };
  const source = "## Feeding\n\nOffer **two portions** a day.";
  const api = fakeApi();
  api.get.mockResolvedValue({
    id: "note-46",
    title: "Daily care",
    status: "open",
    body: source,
  });
  shell.value = shellValue(api, { entry: () => entry });
  await render(
    <ThemeProvider mode="light">
      <ResourceDetail entry={entry} id="note-46" />
    </ThemeProvider>,
  );
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(entry, "note-46"));
  await waitFor(() => expect(screen.getByText("Open")).toBeOnTheScreen());
  expect(screen.getByText("Feeding")).toBeOnTheScreen();
  expect(screen.getByText("two portions")).toBeOnTheScreen();
  expect(screen.queryByText(source)).toBeNull();
});
