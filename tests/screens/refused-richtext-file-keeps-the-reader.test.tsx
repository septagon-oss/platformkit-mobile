// A tenant-scoped file read that answers 404 leaves a missing-image figure in the
// native body. The surrounding Markdown still renders, and no refused byte is asked for.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import type { Entry } from "../../src/core/catalog";
import { createApi } from "../../src/effects/api";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
import { ThemeProvider } from "../../src/ui/theme";
import { asked, resetAsked } from "../fakes/image";
import { reset } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";
import { pageResponse } from "../fakes/wire";

/** key is the credential this connection signs with: a phone presents a key, never a session. */
const key = { token: "pk_live_tenant_one", id: "00000000-0000-4000-8000-000000000001" };

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

test("a second tenant's file refused with 404 keeps its missing figure and native prose", async () => {
  const file = "22222222-2222-4222-8222-222222222222";
  const source = `## Care plan\n\nBefore **the bridge**.\n\n![A bridge](pk-file:${file} "South span")\n\nAfter the bridge.`;
  const entry: Entry = {
    ...note,
    hints: { ...note.hints, previewField: "status" },
    fields: note.fields.map((f) => (f.name === "body" ? { ...f, widget: "richtext" } : f)),
  };
  const files: Entry = { ...note, module: "file", entity: "files", path: "/api/v1/file/files" };
  const calls: Request[] = [];
  const wire = createApi(
    "https://tenant-one.example.test",
    async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      calls.push(request);
      return pageResponse({ status: 404, detail: "Not found" }, 404);
    },
    key,
  );
  const api = fakeApi();
  api.bearer.mockImplementation(() => wire.bearer());
  api.get.mockImplementation(async (e, id) =>
    e.module === "file"
      ? wire.get(e, id)
      : { id: "note-46", title: "Daily care", status: "open", body: source },
  );
  shell.value = shellValue(api, {
    baseURL: "https://tenant-one.example.test",
    entry: (module, entity) => (module === "file" && entity === "files" ? files : entry),
  });
  await render(
    <ThemeProvider mode="light">
      <ResourceDetail entry={entry} id="note-46" />
    </ThemeProvider>,
  );
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(files, file));
  await waitFor(() =>
    expect(calls.map((request) => request.url)).toEqual([
      `https://tenant-one.example.test${files.path}/${file}`,
    ]),
  );
  expect(calls[0]!.headers.get("Authorization")).toBe("Bearer pk_live_tenant_one");
  expect(asked).toEqual([]);
  expect(api.update).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByText("Image unavailable")).toBeOnTheScreen());
  expect(screen.getByText("Care plan")).toBeOnTheScreen();
  expect(screen.getByText("the bridge")).toBeOnTheScreen();
  expect(screen.getByText("After the bridge.")).toBeOnTheScreen();
  expect(screen.getByText("South span")).toBeOnTheScreen();
  expect(screen.queryByText(source)).toBeNull();
});
