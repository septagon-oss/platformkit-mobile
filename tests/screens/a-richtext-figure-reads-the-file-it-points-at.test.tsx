// A rich text figure names a file, not a picture: the body points at `file/files`, that
// row's own measurements reserve the box, and the bytes are asked for at the file's
// content address with the session this app holds. A file this phone cannot read takes
// the native reading of the whole body away — and every word of the body stays on it.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { render, screen, waitFor, within } from "@testing-library/react-native";
import React from "react";
import type { Entry } from "../../src/core/catalog";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
import { ThemeProvider } from "../../src/ui/theme";
import { reset } from "../fakes/router";
import { asked, resetAsked } from "../fakes/image";
import { fakeApi, note, shell, shellValue, type FakeApi } from "../fakes/shell";

jest.mock(
  "expo-router",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").expoRouter,
);
jest.mock(
  "expo-router/react-navigation",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").reactNavigation,
);
jest.mock("expo-image", () => ({
  Image: jest.requireActual<typeof import("../fakes/image")>("../fakes/image").ExpoImage,
}));
jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));

beforeEach(() => {
  reset();
  resetAsked();
});

const FILE = "3f6f0b7f-2b6f-4d8b-9d3a-6f0f3f0f9c31";
const body = `Give **fresh water** every morning.\n\n![The bridge at dusk](pk-file:${FILE} "South span")`;

/** read draws a record whose body holds one figure, with `answers` as that file's row read. */
async function read(answers: (files: Entry) => Record<string, unknown>) {
  const entry: Entry = {
    ...note,
    hints: { ...note.hints, previewField: "status" },
    fields: note.fields.map((field) =>
      field.name === "body" ? { ...field, widget: "richtext" } : field,
    ),
  };
  // The file module, as a server's catalogue names it. The fixture holds only notes.
  const files: Entry = {
    ...note,
    module: "file",
    entity: "files",
    path: "/api/v1/file/files",
  };
  const api: FakeApi = fakeApi();
  api.get.mockImplementation(async (e: Entry) =>
    e.entity === "note"
      ? { id: "note-46", title: "Daily care", status: "open", body }
      : answers(files),
  );
  shell.value = shellValue(api, {
    entry: (module: string, entity: string) =>
      module === "file" && entity === "files" ? files : entry,
  });
  await render(
    <ThemeProvider mode="light">
      <ResourceDetail entry={entry} id="note-46" />
    </ThemeProvider>,
  );
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(entry, "note-46"));
  await waitFor(() => expect(screen.getByTestId("field-body")).toBeOnTheScreen());
  return { api, files };
}

test("a figure reads its own row for the frame and asks for its bytes at the file's address", async () => {
  const { api, files } = await read(() => ({
    id: FILE,
    name: "bridge.heic",
    width: 1440,
    height: 900,
    sha256: "ab12cd34",
  }));
  // The row is read like every other row this screen reads.
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(files, FILE));
  // The bytes come from the address the pinned document gives that file, with the
  // session on them: a native image loader sends no cookie of its own.
  await waitFor(() => expect(asked).toHaveLength(1));
  expect(asked[0]).toEqual({
    uri: `https://acme.test/api/v1/file/files/${FILE}/content`,
    headers: { Cookie: "pk=1" },
    label: "The bridge at dusk",
  });
  // The figure is on the screen while its byte is still in flight: the placeholder keeps
  // the box the row measured, and the loader that will fill it is already asking.
  expect(screen.getByTestId("field-body-prose-figure-fig-0")).toBeOnTheScreen();
  expect(screen.getByTestId("field-body-prose-figure-loading-fig-0")).toBeOnTheScreen();
  const reader = within(screen.getByTestId("field-body-prose"));
  expect(reader.getByText("South span")).toBeOnTheScreen();
  expect(reader.getByText("fresh water")).toBeOnTheScreen();
});

test("a file this phone cannot read takes the native reading away and keeps every word", async () => {
  const { api, files } = await read(() => {
    throw new Error("no read of that file");
  });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(files, FILE));
  const row = within(screen.getByTestId("field-body"));
  // The body is drawn as the text it is, figure syntax and all: the whole record rather
  // than a native body with a picture quietly missing from it.
  expect(row.getByText(body)).toBeOnTheScreen();
  expect(screen.queryByTestId("field-body-prose")).toBeNull();
});
