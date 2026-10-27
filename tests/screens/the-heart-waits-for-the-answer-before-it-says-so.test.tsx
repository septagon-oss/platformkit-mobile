// Rules this file holds about the heart on a record.
// Nothing is drawn before the server answers whether this person keeps a copy — `unknown` is not
// "not kept", and a heart that says a copy is absent when nobody has said so is a control that lies
// about the person's own things. Nothing is optimistic: the pressed state follows the answer, a
// refusal leaves the control exactly where it was with the refusal said under it, and a write the
// network never took says where the change is in the queue's own words. One record pressed twice
// while its write is out was pressed once.
import React from "react";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { parseCatalog, type Catalog } from "../../src/core/catalog";
import { deriveCopy } from "../../src/core/derive";
import type { Row } from "../../src/core/derive";
import type { KeptAnswer, SavedPort } from "../../src/effects/saved";
import type { SavedRef, Savable } from "../../src/core/saved";
import { useSaveToggle } from "../../src/screens/useSaveToggle";
import { SaveButton } from "../../src/ui/molecules/SaveButton";
import { ThemeProvider } from "../../src/ui/theme";
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

const words = deriveCopy("en");

function library(): { catalog: Catalog; product: Catalog["resources"][number] } {
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
          { name: "version", type: "string", readOnly: true },
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
  return { catalog, product: catalog.resources.find((r) => r.entity === "product")! };
}

/** the book is mounted once: an entry read twice would be two objects, and the hook's memo would re-ask on every render. */
const book = library();

/**
 * asking is one record screen's worth of the heart: the hook that asks, and the molecule that
 * draws what it answered.
 */
function Heart(props: { readonly row: Row }) {
  const { model, press } = useSaveToggle(book.product, "p-1", props.row);
  return model ? <SaveButton model={model} onPress={press} /> : null;
}

/**
 * answers is the saved read a record screen is given: every ask is answered from `said`, which the
 * test changes when it wants the next answer, and every write is recorded.
 */
interface Script {
  said: Promise<KeptAnswer>;
  write: () => Promise<{ kept: boolean; held: boolean }>;
  away: () => Promise<void>;
}

function scripted(script: Partial<Script> = {}) {
  const state: Script = {
    said: script.said ?? Promise.resolve<KeptAnswer>({ state: "absent" }),
    write: script.write ?? (async () => ({ kept: true, held: false })),
    away: script.away ?? (async () => undefined),
  };
  const port = {
    probe: jest.fn<SavedPort["probe"]>(async () => state.said),
    keep: jest.fn<SavedPort["keep"]>(async () => state.write()),
    remove: jest.fn<SavedPort["remove"]>(async () => state.away()),
  };
  return { port: port as unknown as SavedPort, state };
}

/** drawing is the whole composition: a shell with the saved read composed, and one record on it. */
function drawing(port: SavedPort | undefined) {
  reset();
  const api = fakeApi();
  shell.value = shellValue(api, {
    saved: port,
    state: { phase: "ready", generation: 1, catalog: book.catalog },
    entry: (module, entity) =>
      book.catalog.resources.find((r) => r.module === module && r.entity === entity),
  });
  return render(
    <ThemeProvider mode="light">
      <Heart row={{ id: "p-1", title: "A look", version: "7" }} />
    </ThemeProvider>,
  );
}

test("no control is drawn until somebody has answered whether a copy is kept", async () => {
  let release: (a: KeptAnswer) => void = () => {};
  const gate = new Promise<KeptAnswer>((resolve) => (release = resolve));
  await drawing(scripted({ said: gate }).port);
  // The ask is under way and the screen says nothing about a copy it does not know of.
  expect(screen.queryByTestId("saved-heart")).toBeNull();
  release({ state: "absent" });
  await waitFor(() => expect(screen.getByTestId("saved-heart")).toBeOnTheScreen());
  expect(screen.getByText("Save")).toBeOnTheScreen();
});

test("a build that composes no saved read draws no heart anywhere", async () => {
  await drawing(undefined);
  expect(screen.queryByTestId("saved-heart")).toBeNull();
});

test("the pressed state follows the answer, and the keep quotes the version this phone read", async () => {
  const { port, state } = scripted();
  await drawing(port);
  await waitFor(() => expect(screen.getByTestId("saved-heart")).toBeOnTheScreen());

  let releaseWrite: (w: { kept: boolean; held: boolean }) => void = () => {};
  state.write = () => new Promise((resolve) => (releaseWrite = resolve));
  state.said = Promise.resolve<KeptAnswer>({ state: "kept", id: "copy-1", revision: 1 });

  fireEvent.press(screen.getByText("Save"));
  // The write is out; the heart has not pressed itself in ahead of the server.
  expect(screen.getByTestId("saved-heart")).toBeOnTheScreen();
  expect(screen.queryByText("Saved")).toBeNull();
  expect(port.keep).toHaveBeenCalledTimes(1);
  const [pair, ref, version] = (port.keep as unknown as { mock: { calls: unknown[][] } }).mock
    .calls[0] as [Savable, SavedRef, string];
  expect(ref).toEqual({ module: "look", kind: "product", key: "p-1" });
  expect(version).toEqual("7");
  expect(pair.list.entity).toEqual("copies");

  releaseWrite({ kept: true, held: false });
  await waitFor(() => expect(screen.getByTestId("saved-heart-pressed")).toBeOnTheScreen());
  expect(shell.value?.wrote).toHaveBeenCalledWith("look/copies");
});

test("a press the server refused leaves the heart where it was and says why under it", async () => {
  const { port } = scripted({
    write: async () => {
      throw new Error("the network never took it");
    },
  });
  await drawing(port);
  await waitFor(() => expect(screen.getByTestId("saved-heart")).toBeOnTheScreen());

  fireEvent.press(screen.getByText("Save"));
  await waitFor(() => expect(port.keep).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByTestId("saved-heart")).toBeOnTheScreen());
  expect(screen.queryByText("Saved")).toBeNull();
  expect(screen.queryByText("Save")).toBeOnTheScreen();
  expect(shell.value?.wrote).not.toHaveBeenCalled();
});

test("a save the network never took says the phone is holding it and never looks kept", async () => {
  const { port } = scripted({ write: async () => ({ kept: false, held: true }) });
  await drawing(port);
  await waitFor(() => expect(screen.getByTestId("saved-heart")).toBeOnTheScreen());

  fireEvent.press(screen.getByText("Save"));
  await waitFor(() =>
    expect(screen.getByText(words.state.holding(words.state.held.title))).toBeOnTheScreen(),
  );
  expect(screen.queryByText("Saved")).toBeNull();
  expect(screen.queryByTestId("saved-heart-pressed")).toBeNull();
});

test("one record pressed twice while its write is out was pressed once", async () => {
  const { port, state } = scripted();
  await drawing(port);
  await waitFor(() => expect(screen.getByTestId("saved-heart")).toBeOnTheScreen());

  let releaseWrite: (w: { kept: boolean; held: boolean }) => void = () => {};
  state.write = () => new Promise((resolve) => (releaseWrite = resolve));
  state.said = Promise.resolve<KeptAnswer>({ state: "kept", id: "copy-1", revision: 1 });

  fireEvent.press(screen.getByText("Save"));
  await waitFor(() => expect(port.keep).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByText("Save"));
  expect(port.keep).toHaveBeenCalledTimes(1);
  releaseWrite({ kept: true, held: false });
  await waitFor(() => expect(screen.getByTestId("saved-heart-pressed")).toBeOnTheScreen());
});

test("a copy this person keeps opens as the kept heart, and a press takes it away by its revision", async () => {
  const { port, state } = scripted({
    said: Promise.resolve<KeptAnswer>({ state: "kept", id: "copy-1", revision: 4 }),
  });
  await drawing(port);
  await waitFor(() => expect(screen.getByTestId("saved-heart-pressed")).toBeOnTheScreen());
  expect(screen.getByText("Saved")).toBeOnTheScreen();

  fireEvent.press(screen.getByText("Saved"));
  await waitFor(() => expect(port.remove).toHaveBeenCalledTimes(1));
  expect((port.remove as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]).toEqual([
    expect.objectContaining({ list: expect.objectContaining({ entity: "copies" }) }),
    "copy-1",
    4,
  ]);
  expect(port.keep).not.toHaveBeenCalled();
  void state;
});
