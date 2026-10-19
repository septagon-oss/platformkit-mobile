// A row a person presses opens its record once: one press, one record on the stack, however the
// platform answers the question of where the row's picture stood. A device answers that question
// (`measureInWindow` calls back with the frame); the host mock every other suite renders against
// never does, so this file answers it the way a device does before pressing.
import React from "react";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { View } from "react-native";
import type { Catalog, Entry } from "../../src/core/catalog";
import { ResourceList } from "../../src/screens/ResourceList";
import { ThemeProvider } from "../../src/ui/theme";
import { reset, router } from "../fakes/router";
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
jest.mock("expo-image", () => ({
  Image: jest.requireActual<typeof import("../fakes/image")>("../fakes/image").ExpoImage,
}));

const FILE = "5b0c7a52-93d4-4f0e-9a51-0d1f6c2e8a47";
const entry: Entry = {
  ...note,
  hints: { icon: "document", thumbnailField: "photo" },
  fields: [...note.fields, { name: "photo", type: "uuid", present: "image" }],
};
const files: Entry = {
  ...note,
  module: "file",
  entity: "file",
  path: "/api/v1/file/files",
  operations: ["read"],
};
const catalog: Catalog = {
  version: 2,
  resources: [entry, files],
  pictures: { source: "/api/v1/file/files/{id}/content", widths: [480, 960] },
};

type Measured = (x: number, y: number, width: number, height: number) => void;
const host = View.prototype as unknown as { measureInWindow: (answer: Measured) => void };
const unmeasured = host.measureInWindow;

beforeEach(() => {
  reset();
  // What a phone answers when the list asks where a row's picture stood.
  host.measureInWindow = (answer: Measured) => answer(16, 212, 48, 48);
});
afterEach(() => {
  host.measureInWindow = unmeasured;
  shell.value = undefined;
});

test("a row pressed once opens its record once", async () => {
  const api = fakeApi();
  api.list.mockResolvedValue({
    items: [{ id: "kettle-7", title: "Descale the kettle", status: "open", photo: FILE }],
    total: 1,
  });
  api.get.mockResolvedValue({ id: FILE, width: 800, height: 800, sha256: "frame-1" });
  shell.value = shellValue(api, {
    state: { phase: "ready", generation: 1, catalog },
    entry: (module, entity) => (module === "file" && entity === "file" ? files : entry),
  });
  await render(
    <ThemeProvider mode="light">
      <ResourceList entry={entry} />
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("row-kettle-7")).toBeOnTheScreen());

  fireEvent.press(screen.getByTestId("row-kettle-7"));

  await waitFor(() => expect(router.push).toHaveBeenCalled());
  expect(router.push.mock.calls).toEqual([["/note/note/kettle-7"]]);
  // The record reads where the finger was as it mounts, so the frame is filed before the push
  // that mounts it, once, under the address it opens.
  const travelTo = jest.mocked(shell.value!.travelTo);
  expect(travelTo.mock.calls).toEqual([
    ["/note/note/kettle-7", { x: 16, y: 212, width: 48, height: 48 }],
  ]);
  expect(travelTo.mock.invocationCallOrder[0]).toBeLessThan(
    router.push.mock.invocationCallOrder[0]!,
  );
});
