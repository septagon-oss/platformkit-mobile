// Inserting a new phone photo starts by choosing the photo library or camera.
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
jest.mock("../../src/ui/chooser", () => ({ choose: jest.fn(), confirm: jest.fn() }));

beforeEach(() => {
  reset();
  jest.clearAllMocks();
});

test("Image offers the photo library and camera even when the tenant has no uploaded files", async () => {
  const entry: Entry = {
    ...note,
    fields: note.fields.map((f) => (f.name === "body" ? { ...f, widget: "richtext" } : f)),
  };
  const files: Entry = { ...note, module: "file", entity: "files", path: "/api/v1/file/files" };
  const api = fakeApi();
  api.get.mockResolvedValue({
    id: "note-46",
    title: "Daily care",
    body: "Give fresh water.",
    status: "open",
  });
  shell.value = shellValue(api, { entry: (module) => (module === "file" ? files : entry) });
  await render(
    <ThemeProvider mode="light">
      <ResourceForm entry={entry} id="note-46" />
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("save")).toBeEnabled());
  await fireEvent.press(screen.getByRole("button", { name: "Image" }));
  const { choose } =
    jest.requireMock<typeof import("../../src/ui/chooser")>("../../src/ui/chooser");
  const labels = () =>
    [
      ...jest.mocked(choose).mock.calls.flatMap((call) => call[1].map((choice) => choice.label)),
      ...screen
        .queryAllByRole("button")
        .map((button) => String(button.props.accessibilityLabel ?? "")),
    ].join(" | ");
  await waitFor(() => {
    expect(labels()).toMatch(/photo library|biblioteca.*foto|galeria.*foto/i);
    expect(labels()).toMatch(/take photo|camera|câmera|tirar foto/i);
  });
  expect(api.update).not.toHaveBeenCalled();
});
