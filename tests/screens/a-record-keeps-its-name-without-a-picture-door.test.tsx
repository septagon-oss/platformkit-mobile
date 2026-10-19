// A record whose entry names a cover field, served by a catalogue that offers no picture door,
// cannot draw its cover: the phone has no way to read the bytes. It is then a record with no
// picture, and it keeps the header a record with no picture has always had — its name in the
// native header, which is not made transparent over a photo that is not there.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import React from "react";
import { readFileSync } from "node:fs";
import { render, screen, waitFor } from "@testing-library/react-native";
import { parseCatalog, type Catalog } from "../../src/core/catalog";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
import { ThemeProvider } from "../../src/ui/theme";
import { header, reset } from "../fakes/router";
import { fakeApi, shell, shellValue } from "../fakes/shell";

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

// The reference composition's catalogue, as served by a server that composes no picture door:
// the content entry still names `coverImageId` as its cover, which the parser accepts on its own.
const { pictures: _door, ...served } = parseCatalog(
  JSON.parse(readFileSync("testdata/catalog.pictures.json", "utf8")),
);
const catalog: Catalog = served;
const content = catalog.resources.find((r) => r.entity === "content")!;
const COVER = "5b0f6f39-2c51-4f0e-9a39-0d8a1e7c6a41";
const NAME = "Harbour walk";

beforeEach(() => reset());
afterEach(() => {
  shell.value = undefined;
});

test("a record with a cover field keeps its name when the server offers no picture door", async () => {
  expect(content.hints?.coverField).toBe("coverImageId");
  expect(catalog.pictures).toBeUndefined();
  const api = fakeApi();
  api.get.mockResolvedValue({
    id: "walk-1",
    slug: "harbour-walk",
    title: NAME,
    kind: "post",
    status: "published",
    coverImageId: COVER,
  });
  shell.value = shellValue(api, {
    identity: { userId: "person-a", email: "ana@example.test", permissions: [] },
    state: { phase: "ready", generation: 1, catalog },
    entry: (module, entity) =>
      catalog.resources.find((r) => r.module === module && r.entity === entity),
  });
  await render(
    <ThemeProvider mode="light">
      <ResourceDetail entry={content} id="walk-1" />
    </ThemeProvider>,
  );
  // The record has arrived: its facts are drawn.
  await waitFor(() => expect(screen.getByTestId("field-slug")).toBeOnTheScreen());
  const options = header.options as { title?: string; headerTransparent?: boolean } | undefined;
  const coverTitle = screen.queryByTestId("record-title");
  // The name is drawn exactly once: in the native header, or standing on a drawn cover.
  const named = [options?.title === NAME, coverTitle?.props.children === NAME].filter(Boolean);
  expect(named).toHaveLength(1);
  // A transparent header is a promise that a cover stands under it.
  if (options?.headerTransparent === true)
    expect(screen.queryByTestId("record-cover")).toBeOnTheScreen();
});
