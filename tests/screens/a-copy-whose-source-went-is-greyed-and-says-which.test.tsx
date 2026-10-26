// Rules this file holds about a person's list of saved copies.
// A copy whose source has gone is still the copy this person kept: it stays in the list, still
// opens, and still says which kind of gone it is — "this record has gone" and "this provider is
// down" are two answers and never one sentence. The grey is the theme's muted ink and the sentence
// is the kit's copy table, both read through the entry's own `availabilityField`, and a copy whose
// source is there says nothing about availability at all.
import React from "react";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { parseCatalog, type Entry } from "../../src/core/catalog";
import { deriveCopy } from "../../src/core/derive";
import { ResourceList } from "../../src/screens/ResourceList";
import { ThemeProvider, themeFor } from "../../src/ui/theme";
import { navigations, reset } from "../fakes/router";
import { fakeApi, shell, shellValue } from "../fakes/shell";

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

const ink = themeFor("light").color;
const words = deriveCopy("en").kit;

/** library is a mounted catalogue with a savable source and the entry that holds its copies. */
function library() {
  const catalog = parseCatalog({
    catalogVersion: 3,
    resources: [
      {
        module: "look",
        entity: "product",
        path: "/api/v1/look/products",
        screen: "/app/look/products",
        writable: false,
        fields: [
          { name: "id", type: "uuid", readOnly: true },
          { name: "title", type: "string" },
        ],
        commands: [],
        presentation: {
          filters: [],
          saved: {
            save: "Save",
            saved: "Saved",
            remove: "Remove",
            listTitle: "Saved",
            listEntry: "look/copies",
          },
        },
      },
      {
        module: "look",
        entity: "copies",
        path: "/api/v1/look/copies",
        screen: "/app/look/copies",
        writable: true,
        fields: [
          { name: "id", type: "uuid", readOnly: true },
          { name: "title", type: "string", readOnly: true },
          { name: "sourceAvailability", type: "string", readOnly: true, hideList: true },
          { name: "revision", type: "int", readOnly: true, hideList: true },
        ],
        commands: [
          {
            verb: "save",
            summary: "Keep a copy",
            collection: true,
            fields: [{ name: "source", type: "string", required: true }],
          },
          {
            verb: "unsave",
            summary: "Take one copy away",
            fields: [
              { name: "id", type: "uuid", required: true },
              { name: "expectedRevision", type: "int", required: true },
            ],
          },
        ],
        presentation: { filters: [], availabilityField: "sourceAvailability" },
      },
    ],
  });
  return {
    catalog,
    copies: catalog.resources.find((r) => r.entity === "copies")! as Entry,
  };
}

/** showing is the list of copies drawn over a server that answers these rows. */
async function showing(rows: readonly Record<string, unknown>[]) {
  reset();
  const { catalog, copies } = library();
  const api = fakeApi();
  shell.value = shellValue(api, {
    state: { phase: "ready", generation: 1, catalog },
    entry: (module, entity) =>
      catalog.resources.find((r) => r.module === module && r.entity === entity),
  });
  api.list.mockResolvedValue({ items: rows, total: rows.length });
  await render(
    <ThemeProvider mode="light">
      <ResourceList entry={copies} />
    </ThemeProvider>,
  );
}

const keptRow = {
  id: "c-1",
  title: "The look I kept",
  sourceAvailability: "unavailable",
  revision: 1,
};

test("a copy whose source has gone is greyed, says so, and still opens", async () => {
  await showing([keptRow]);
  const title = await screen.findByText("The look I kept");
  expect(screen.getByText(words.savedUnavailable)).toBeOnTheScreen();
  expect(title).toHaveStyle({ color: ink.textMuted });
  fireEvent.press(title);
  expect(navigations.some((to) => to.includes("c-1"))).toBe(true);
});

test("a copy whose provider is down says it is down rather than gone", async () => {
  await showing([{ ...keptRow, sourceAvailability: "temporary" }]);
  const title = await screen.findByText("The look I kept");
  expect(screen.getByText(words.savedTemporary)).toBeOnTheScreen();
  expect(screen.queryByText(words.savedUnavailable)).toBeNull();
  expect(title).toHaveStyle({ color: ink.textMuted });
});

test("a copy whose source is there says nothing about availability", async () => {
  await showing([{ ...keptRow, sourceAvailability: "available" }]);
  const title = await screen.findByText("The look I kept");
  expect(screen.queryByText(words.savedUnavailable)).toBeNull();
  expect(screen.queryByText(words.savedTemporary)).toBeNull();
  expect(title).toHaveStyle({ color: ink.textPrimary });
});
