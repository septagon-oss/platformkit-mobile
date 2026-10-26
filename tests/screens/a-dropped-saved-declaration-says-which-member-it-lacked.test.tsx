// Rules this file holds about the heart's absence.
// A saved declaration the phone cannot carry costs the control and says which member it could
// not carry — through the same notice line a hint the catalogue read itself refused takes, so
// a heart that never appears leaves a trace an author can read. A record whose entry declares
// nothing is the ordinary case and says nothing at all: silence is the answer to "this is not
// a savable thing", and a warning on every record would teach nobody to read the warning.
import React from "react";
import { expect, jest, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react-native";
import { parseCatalog, type Catalog } from "../../src/core/catalog";
import { savable } from "../../src/core/saved";
import { useSaveToggle } from "../../src/screens/useSaveToggle";
import { SaveButton } from "../../src/ui/molecules/SaveButton";
import { ThemeProvider } from "../../src/ui/theme";
import { absent, fakeSaved } from "../fakes/saved";
import { reset } from "../fakes/router";
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

/**
 * library is the catalogue a record screen is mounted on.
 *
 * `saved` is what the source declares about being saved and `listEntry` the "module/entity"
 * it points at; the entry holding the copies is always mounted, so the only defect a case
 * can install is in the declaration itself.
 */
function library(
  saved: Record<string, unknown> | null = {
    save: "Save",
    saved: "Saved",
    remove: "Remove",
    listEntry: "look/copies",
  },
): Catalog {
  return parseCatalog({
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
        presentation: { filters: [], ...(saved === null ? {} : { saved }) },
      },
      {
        module: "look",
        entity: "copies",
        path: "/api/v1/look/copies",
        screen: "/app/look/copies",
        writable: true,
        fields: [
          { name: "id", type: "uuid", readOnly: true },
          { name: "revision", type: "int", readOnly: true },
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
        presentation: { filters: [] },
      },
    ],
  });
}

/** Heart is one record's worth of the control: the hook that asks and the molecule that draws. */
function Heart({ entry }: { readonly entry: Catalog["resources"][number] }) {
  const { model, press } = useSaveToggle(entry, "p-1", { id: "p-1", title: "A look" });
  return model ? <SaveButton model={model} onPress={press} /> : null;
}

/** standing is a record screen over a composed saved read and the catalogue the case declares. */
function standing(catalog: Catalog) {
  reset();
  const api = fakeApi();
  shell.value = shellValue(api, {
    // Nobody keeps this one, which `probe` answers absent and nothing else.
    saved: fakeSaved({ probes: [absent] }).port,
    state: { phase: "ready", generation: 1, catalog },
    entry: (module, entity) =>
      catalog.resources.find((r) => r.module === module && r.entity === entity),
  });
  const source = catalog.resources.find((r) => r.entity === "product")!;
  render(
    <ThemeProvider mode="light">
      <Heart entry={source} />
    </ThemeProvider>,
  );
  return api;
}

test("a declaration pointing at no entry of this catalogue says where it pointed", async () => {
  const api = standing(
    library({ save: "Save", saved: "Saved", remove: "Remove", listEntry: "look/shelf" }),
  );
  await waitFor(() =>
    expect(api.notice).toHaveBeenCalledWith(
      "presentation.saved.listEntry",
      'names "look/shelf", which no entry of this catalogue prints: no heart is drawn',
    ),
  );
  expect(screen.queryByTestId("saved-heart")).toBeNull();
});

test("a heart that is drawable says nothing about itself", async () => {
  const api = standing(library());
  await waitFor(() => expect(screen.getByTestId("saved-heart")).toBeOnTheScreen());
  expect(api.notice).not.toHaveBeenCalled();
});

test("an entry that declares nothing about being saved is silence, not a defect", async () => {
  const catalog = library(null);
  const api = standing(catalog);
  await waitFor(() => expect(screen.queryByTestId("saved-heart")).toBeNull());
  expect(api.notice).not.toHaveBeenCalled();
  expect(
    savable(catalog.resources[0]!, catalog.resources, (at) => {
      throw new Error(`said ${at}`);
    }),
  ).toBeUndefined();
});
