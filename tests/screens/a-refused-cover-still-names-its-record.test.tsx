// A record whose cover file the server refuses to describe still opens on its cover: the
// picture door is composed and the session can read with it, so the native header goes
// transparent — and the cover then owes the record its name, standing in the frame beside
// the sentence that says the picture will not come. The name is drawn once, on the cover.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import React from "react";
import { readFileSync } from "node:fs";
import { render, screen, waitFor, within } from "@testing-library/react-native";
import { parseCatalog, type Catalog } from "../../src/core/catalog";
import { deriveCopy } from "../../src/core/derive";
import { ApiError } from "../../src/effects/api";
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

const catalog: Catalog = parseCatalog(
  JSON.parse(readFileSync("testdata/catalog.pictures.json", "utf8")),
);
const content = catalog.resources.find((r) => r.entity === "content")!;
const COVER = "7d3c1a52-9e4b-4c1f-8a6d-2f5e0b9c4d18";
const NAME = "Lighthouse at dusk";
const kit = deriveCopy("en").kit;

beforeEach(() => reset());
afterEach(() => {
  shell.value = undefined;
});

test.each([403, 404])(
  "a record whose cover file is refused (%i) keeps its name on the cover under a transparent header",
  async (status) => {
    expect(catalog.pictures).toBeDefined();
    const api = fakeApi();
    api.get.mockImplementation(async (target) => {
      if (target.module === "file") throw new ApiError(status, "Refused");
      return {
        id: "dusk-1",
        slug: "lighthouse-at-dusk",
        title: NAME,
        kind: "post",
        status: "published",
        coverImageId: COVER,
      };
    });
    shell.value = shellValue(api, {
      identity: { userId: "person-b", email: "rui@example.test", permissions: [] },
      state: { phase: "ready", generation: 1, catalog },
      entry: (module, entity) =>
        catalog.resources.find((r) => r.module === module && r.entity === entity),
    });
    await render(
      <ThemeProvider mode="light">
        <ResourceDetail entry={content} id="dusk-1" />
      </ThemeProvider>,
    );
    // The record has arrived and the file's refusal has been answered in the cover's frame.
    await waitFor(() => expect(screen.getByTestId("field-slug")).toBeOnTheScreen());
    const cover = await screen.findByTestId("record-cover");
    await waitFor(() => expect(within(cover).getByText(kit.imageUnavailable)).toBeOnTheScreen());
    // The header went transparent over that cover, so the cover carries the name — once.
    const options = header.options as { title?: string; headerTransparent?: boolean };
    expect(options.headerTransparent).toBe(true);
    expect(options.title).toBe("");
    expect(within(cover).getByTestId("record-title").props.children).toBe(NAME);
    expect(screen.getAllByText(NAME)).toHaveLength(1);
  },
);
