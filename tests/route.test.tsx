import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import type { Catalog, Entry, RendererRef } from "../src/core/catalog";
import { SHELL_VERSION } from "../src/core/catalog";
import type { Renderer, Renderers, ScreenProps } from "../src/renderers";
import { commandSheet, ResourceRoute, sheet } from "../src/route";
import type { ShellValue } from "../src/shell";
import { reset, setParams } from "./fakes/router";
import { catalog, fakeApi, type FakeApi, shell, shellValue } from "./fakes/shell";

jest.mock("expo-router", () => require("./fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("./fakes/router").reactNavigation);
jest.mock("../src/shell", () => ({ useShell: () => require("./fakes/shell").shell.value }));

// A renderer pack's screen: it says what it was given.
const seen: ScreenProps[] = [];
function Custom(props: ScreenProps) {
  seen.push(props);
  return (
    <Text testID="custom">{`${props.entry.entity}:${props.id ?? "-"}:${props.verb ?? "-"}`}</Text>
  );
}

beforeEach(() => {
  reset();
  seen.length = 0;
  setParams({ module: "note", entity: "note", id: "42", verb: "publish" });
  shell.value = shellValue(fakeApi());
});

/**
 * naming is the fixture's note entry with a `renderer` on it — the key the
 * pinned catalogue does not print, so a test that asks for one builds its own
 * document rather than editing the bytes the golden check pins.
 */
function naming(renderer: RendererRef | undefined, over: Partial<ShellValue> = {}): FakeApi {
  const resources: readonly Entry[] = catalog.resources.map((e) =>
    e.module === "note" && e.entity === "note" && renderer ? { ...e, renderer } : e,
  );
  const mine: Catalog = { ...catalog, resources };
  const api = fakeApi();
  api.get.mockResolvedValue({ id: "42", title: "Buy milk" });
  shell.value = shellValue(api, {
    state: { phase: "ready", generation: 1, catalog: mine },
    entry: (module, entity) =>
      mine.resources.find((r) => r.module === module && r.entity === entity),
    ...over,
  });
  return api;
}

const packWith = (kind: keyof Renderer, screen: React.ComponentType<ScreenProps>): Renderers => ({
  "task/tasks": { [kind]: screen },
});

describe("ResourceRoute", () => {
  test("anonymous and signing-in are sent to sign in; booting and loading wait; failed says why", async () => {
    for (const phase of ["anonymous", "signing-in"] as const) {
      shell.value = shellValue(fakeApi(), { state: { phase, generation: 1 } });
      await render(<ResourceRoute kind="list" />);
      expect(screen.getByTestId("redirect")).toHaveTextContent(/^\/sign-in$/);
      await screen.unmount();
    }
    for (const phase of ["booting", "loading"] as const) {
      shell.value = shellValue(fakeApi(), { state: { phase, generation: 1 } });
      await render(<ResourceRoute kind="list" />);
      expect(screen.getByLabelText("Loading")).toBeOnTheScreen();
      await screen.unmount();
    }
    shell.value = shellValue(fakeApi(), {
      state: { phase: "failed", generation: 1, error: "acme.test did not answer" },
    });
    await render(<ResourceRoute kind="list" />);
    // A regex, because the notice's glyph is a character too.
    expect(screen.getByRole("alert")).toHaveTextContent(/acme\.test did not answer/);
    await screen.unmount();
    shell.value = shellValue(fakeApi(), { state: { phase: "failed", generation: 1 } });
    await render(<ResourceRoute kind="list" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/The catalog could not be read\./);
  });

  test("a path without a resource goes home; one the catalog lacks says so", async () => {
    setParams({});
    await render(<ResourceRoute kind="list" />);
    expect(screen.getByTestId("redirect")).toHaveTextContent(/^\/$/);
    await screen.unmount();
    setParams({ module: "billing", entity: "invoice" });
    await render(<ResourceRoute kind="detail" withID />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /billing\/invoice is not in this installation\./,
    );
  });

  test("the pack's screen wins for its kind and is given the entry, the id and the verb; the other kinds stay generated", async () => {
    const api = fakeApi();
    api.get.mockResolvedValue({ id: "42", title: "Buy milk" });
    shell.value = shellValue(api, {
      renderers: { "note/note": { detail: Custom, command: Custom } },
    });
    await render(<ResourceRoute kind="detail" withID />);
    expect(screen.getByTestId("custom")).toHaveTextContent("note:42:-");
    await screen.unmount();
    await render(<ResourceRoute kind="command" withID withVerb />);
    expect(screen.getByTestId("custom")).toHaveTextContent("note:42:publish");
    expect(seen.map((p) => p.entry.path)).toEqual(["/api/v1/note/notes", "/api/v1/note/notes"]);
    await screen.unmount();
    await render(<ResourceRoute kind="list" />);
    expect(await screen.findByTestId("resource-list")).toBeOnTheScreen();
    expect(screen.queryByTestId("custom")).toBeNull();
    await screen.unmount();
    await render(<ResourceRoute kind="form" withID />);
    expect(await screen.findByTestId("resource-form")).toBeOnTheScreen();
    expect(api.get).toHaveBeenCalledWith(expect.objectContaining({ entity: "note" }), "42");
  });

  test("a singleton's list route is the record itself, unless the pack says otherwise", async () => {
    setParams({ module: "note", entity: "setting" });
    const api = fakeApi();
    api.one.mockResolvedValue({ id: "s", title: "Site" });
    shell.value = shellValue(api);
    await render(<ResourceRoute kind="list" />);
    expect(await screen.findByTestId("resource-detail")).toBeOnTheScreen();
    expect(screen.queryByTestId("resource-list")).toBeNull();
    expect(api.one).toHaveBeenCalledWith(expect.objectContaining({ entity: "setting" }));
    expect(api.list).not.toHaveBeenCalled();
    await screen.unmount();
    shell.value = shellValue(api, { renderers: { "note/setting": { list: Custom } } });
    await render(<ResourceRoute kind="list" />);
    expect(screen.getByTestId("custom")).toHaveTextContent("setting:-:-");
  });

  test("the pack the catalogue names is drawn under whatever route the entry is reached from", async () => {
    // The catalogue's `renderer`, not the path, chooses the screen: this entry is
    // note/note at /api/v1/note/notes, and it asks for the pack keyed task/tasks.
    naming(
      { name: "task/tasks", minShell: SHELL_VERSION },
      { renderers: packWith("detail", Custom) },
    );
    await render(<ResourceRoute kind="detail" withID />);
    expect(screen.getByTestId("custom")).toHaveTextContent("note:42:-");
    await screen.unmount();
    // Which pack draws the row decides nothing about what is read: the address,
    // the verb and the entry the pack is handed are the entry's own.
    expect(seen.map((p) => p.entry.path)).toEqual(["/api/v1/note/notes"]);
  });

  test("a screen that needs a newer shell falls back to the generated one and says so quietly", async () => {
    naming(
      { name: "task/tasks", minShell: SHELL_VERSION + 1 },
      { renderers: packWith("detail", Custom) },
    );
    await render(<ResourceRoute kind="detail" withID />);
    // The generated detail: which means the row was still read and drawn.
    expect(await screen.findByTestId("resource-detail")).toBeOnTheScreen();
    expect(screen.queryByTestId("custom")).toBeNull();
    expect(screen.getByTestId("shell-update")).toBeOnTheScreen();
    expect(screen.getByTestId("shell-update")).toHaveTextContent(/update the app/i);
  });

  test("a pack this build does not carry is no news: the generated screen says nothing", async () => {
    naming({ name: "acme/report", minShell: SHELL_VERSION });
    await render(<ResourceRoute kind="detail" withID />);
    expect(await screen.findByTestId("resource-detail")).toBeOnTheScreen();
    expect(screen.queryByTestId("shell-update")).toBeNull();
  });

  test("a pack drawn for one kind leaves every other kind generated", async () => {
    naming(
      { name: "task/tasks", minShell: SHELL_VERSION },
      { renderers: packWith("detail", Custom) },
    );
    await render(<ResourceRoute kind="form" withID />);
    expect(await screen.findByTestId("resource-form")).toBeOnTheScreen();
    expect(screen.queryByTestId("custom")).toBeNull();
    expect(screen.queryByTestId("shell-update")).toBeNull();
    await screen.unmount();
    // A singleton keeps its own rule even when the pack it names has no list:
    // the record itself, not a list of one with a New button on it.
    setParams({ module: "note", entity: "setting" });
    naming({ name: "task/tasks", minShell: SHELL_VERSION });
    ((shell.value as ShellValue).api as FakeApi).one.mockResolvedValue({ id: "s", title: "Site" });
    await render(<ResourceRoute kind="list" />);
    expect(await screen.findByTestId("resource-detail")).toBeOnTheScreen();
    expect(screen.queryByTestId("resource-list")).toBeNull();
  });
});

describe("sheets", () => {
  test("a sheet is titled from the path before it mounts; a command sheet by its verb as words", () => {
    expect(sheet("New ")({ route: { params: { entity: "note" } } })).toEqual({
      presentation: "modal",
      headerLargeTitleEnabled: false,
      title: "New note",
    });
    expect(sheet("Edit ")({ route: {} }).title).toBe("Edit ");
    expect(commandSheet({ route: { params: { verb: "mark-paid" } } })).toEqual({
      presentation: "modal",
      headerLargeTitleEnabled: false,
      title: "Mark paid",
    });
  });
});
