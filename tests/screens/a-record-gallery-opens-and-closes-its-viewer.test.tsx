// A pressed gallery tile opens the kit's viewer at the very picture that was pressed, pages
// it by file identifier — never by position — and closes back to the record untouched. This
// is that round trip read off the real screen, with no pinch surface supplied, which is what
// a product that ships one still falls back to on every other page.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import React from "react";
import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { parseCatalog, type Catalog, type Entry } from "../../src/core/catalog";
import { deriveCopy } from "../../src/core/derive";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
import { ThemeProvider } from "../../src/ui/theme";
import { nativeRequests, resetAsked } from "../fakes/image";
import { fakeApi, shell, shellValue } from "../fakes/shell";
import { header, reset } from "../fakes/router";

jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));
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

const catalog: Catalog = parseCatalog(
  JSON.parse(readFileSync("testdata/catalog.pictures.json", "utf8")),
);
// The reference composition's content entry, given one gallery the row fills.
const entry: Entry = {
  ...catalog.resources.find((r) => r.entity === "content")!,
  fields: [
    ...(catalog.resources.find((r) => r.entity === "content")?.fields ?? []),
    { name: "shots", type: "list", elem: "uuid", present: "images" },
  ],
};
const served: Catalog = {
  ...catalog,
  resources: catalog.resources.map((r) => (r.entity === "content" ? entry : r)),
};
const COVER = "03fcde99-d7e5-456e-ab15-8680a4450b13";
const FIRST = "11111111-1111-4111-8111-111111111111";
const SECOND = "22222222-2222-4222-8222-222222222222";
const kit = deriveCopy("en").kit;
const row = {
  id: "record-1",
  slug: "field-notes",
  title: "Field notes",
  body: "Two paragraphs",
  kind: "post",
  status: "published",
  coverImageId: COVER,
  shots: [FIRST, SECOND],
};
const position = (one: number, of: number) => `${one} ${kit.of} ${of}`;

beforeEach(() => {
  reset();
  resetAsked();
});
afterEach(() => {
  shell.value = undefined;
});

test("a pressed gallery tile opens the viewer at that picture and closes back to the record", async () => {
  const api = fakeApi();
  api.get.mockImplementation(async (target, id) =>
    target.module === "file"
      ? {
          id,
          width: 800,
          height: 600,
          alt: id === FIRST ? "The first morning" : "The second",
          sha256: `frame-${id.slice(0, 4)}`,
          visibility: "private",
        }
      : row,
  );
  shell.value = shellValue(api, {
    identity: { userId: "person-a", email: "ana@example.test", permissions: [] },
    state: { phase: "ready", generation: 1, catalog: served },
    entry: (module, entity) =>
      served.resources.find((r) => r.module === module && r.entity === entity),
  });
  await render(
    <ThemeProvider mode="light">
      <ResourceDetail entry={entry} id="record-1" />
    </ThemeProvider>,
  );
  // The gallery is drawn once each file's frame has been read; the viewer is not mounted yet.
  await waitFor(() => expect(screen.getByTestId("photo-strip")).toBeOnTheScreen());
  expect(screen.queryByRole("button", { name: kit.close })).toBeNull();
  // A tile is offered only once its own bytes report ready: the cover and the two tiles
  // load, and each answers through its own slot.
  await waitFor(() => expect(nativeRequests.length).toBe(3));
  await act(async () => {
    for (const request of [...nativeRequests]) request.onLoad();
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: `${kit.open}: The second` })).toBeOnTheScreen(),
  );

  await fireEvent.press(screen.getByTestId("photo-1"));
  // The viewer opens at the pressed file — the second of the strip, and the position is
  // answered from the file identifier, never from a remembered index.
  expect(screen.getByText(position(2, 2))).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: kit.next })).toBeDisabled();

  // Paging moves the selection by identifier.
  await fireEvent.press(screen.getByRole("button", { name: kit.previous }));
  expect(screen.getByText(position(1, 2))).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: kit.previous })).toBeDisabled();

  // Closing unmounts the viewer; the record stays where it was, named as it was.
  await fireEvent.press(screen.getByRole("button", { name: kit.close }));
  expect(screen.queryByRole("button", { name: kit.close })).toBeNull();
  expect(screen.queryByText(position(1, 2))).toBeNull();
  expect(screen.getByTestId("resource-detail")).toBeOnTheScreen();
  expect(screen.getByTestId("record-cover")).toBeOnTheScreen();
  expect(header.options).toMatchObject({ headerTransparent: true });
});
