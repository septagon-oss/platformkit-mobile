// Choosing a file is asynchronous; typing while it loads must survive the insertion.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Entry } from "../../src/core/catalog";
import { ResourceForm } from "../../src/screens/ResourceForm";
import { ThemeProvider } from "../../src/ui/theme";
import type { Choice } from "../../src/ui/chooser";
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

test("an image chosen after another edit preserves the latest draft", async () => {
  const entry: Entry = {
    ...note,
    fields: note.fields.map((f) => (f.name === "body" ? { ...f, widget: "richtext" } : f)),
  };
  const files: Entry = { ...note, module: "file", entity: "files", path: "/api/v1/file/files" };
  const api = fakeApi();
  api.get.mockResolvedValue({
    id: "note-46",
    title: "Daily care",
    body: "Before.",
    status: "open",
  });
  let resolveFiles!: (value: { items: Record<string, unknown>[]; total: number }) => void;
  api.list.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveFiles = resolve;
      }),
  );
  shell.value = shellValue(api, { entry: (module) => (module === "file" ? files : entry) });
  await render(
    <ThemeProvider mode="light">
      <ResourceForm entry={entry} id="note-46" />
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("save")).toBeEnabled());
  await fireEvent.changeText(screen.getByTestId("input-body"), "Before. Initial edit.");
  await fireEvent(screen.getByTestId("input-body"), "selectionChange", {
    nativeEvent: { selection: { start: 7, end: 7 } },
  });
  await fireEvent.press(screen.getByRole("button", { name: "Image" }));
  await waitFor(() => expect(api.list).toHaveBeenCalledWith(files, { limit: 6 }));
  await fireEvent.changeText(
    screen.getByTestId("input-body"),
    "Before. Initial edit. Keep this sentence.",
  );
  resolveFiles({
    items: [{ id: "11111111-1111-4111-8111-111111111111", title: "Garden" }],
    total: 1,
  });
  const { choose } =
    jest.requireMock<typeof import("../../src/ui/chooser")>("../../src/ui/chooser");
  await waitFor(() => expect(choose).toHaveBeenCalled());
  const options = jest.mocked(choose).mock.calls[0]![1] as readonly Choice[];
  const picture = options.find((option) => option.label === "Garden");
  expect(picture).toBeDefined();
  await act(() => picture!.onPress());
  expect(screen.getByTestId("input-body").props.value).toContain("Keep this sentence.");
  expect(screen.getByTestId("input-body").props.value).toContain(
    "pk-file:11111111-1111-4111-8111-111111111111",
  );
  expect(api.update).not.toHaveBeenCalled();
});
