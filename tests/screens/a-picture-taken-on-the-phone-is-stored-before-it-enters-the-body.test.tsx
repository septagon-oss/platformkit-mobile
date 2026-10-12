// A picture taken on the phone is stored as a file before the body points at it: the body
// never learns an address that only this phone could read.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import type { Entry } from "../../src/core/catalog";
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
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: "file:///cache/shelf.jpg", fileName: "shelf.jpg", mimeType: "image/jpeg" }],
  })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [] })),
}));

beforeEach(() => {
  reset();
  jest.clearAllMocks();
});

test("a picture taken here is stored as a file, and the body points at that file", async () => {
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
  api.upload.mockResolvedValue({
    id: "44444444-4444-4144-8144-444444444444",
    title: "shelf.jpg",
    hash: "sha256:aaa",
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
  await waitFor(() => expect(choose).toHaveBeenCalled());
  const options = jest.mocked(choose).mock.calls[0]![1] as readonly Choice[];
  const camera = options.find((option) => option.label === "Take photo");
  expect(camera).toBeDefined();
  await act(async () => camera!.onPress());
  await waitFor(() => expect(api.upload).toHaveBeenCalled());
  const [entry_, form, query] = jest.mocked(api.upload).mock.calls[0]!;
  expect(entry_.path).toBe(files.path);
  expect(query).toBe("?image=true");
  expect(form).toBeInstanceOf(FormData);
  expect(screen.getByTestId("input-body").props.value).toContain(
    "pk-file:44444444-4444-4144-8144-444444444444",
  );
  expect(api.update).not.toHaveBeenCalled();
});
