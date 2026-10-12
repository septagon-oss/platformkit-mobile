// A catalogue document, as the server prints it, that names a pack this build
// carries but cannot draw yet: the record is still read and drawn by the
// generated detail, the foot says the app is behind, and the pack's own typed
// read is never asked. A malformed `renderer` costs the entry nothing.
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { parseCatalog, SHELL_VERSION, type Entry } from "../../src/core/catalog";
import { taskRenderers } from "../../src/examples/taskRenderers";
import { ResourceRoute } from "../../src/route";
import { ThemeProvider } from "../../src/ui/theme";
import { reset, setParams } from "../fakes/router";
import { fakeApi, recorded, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));

const row = { id: "t-77", title: "Calibrate the scale", status: "open" };

function serve(renderer: unknown) {
  const catalog = parseCatalog({
    catalogVersion: 2,
    resources: [
      {
        module: "task",
        entity: "task",
        path: "/api/v1/task/tasks",
        writable: true,
        renderer,
        fields: [
          { name: "id", type: "uuid", readOnly: true },
          { name: "title", type: "string" },
          { name: "status", type: "string", enum: ["open", "resolved"] },
        ],
        commands: [],
      },
    ],
  });
  const typed = recorded(row);
  const api = fakeApi(typed.operations);
  api.get.mockResolvedValue(row);
  shell.value = shellValue(api, {
    state: { phase: "ready", generation: 1, catalog },
    renderers: { "task/tasks": taskRenderers },
    entry: (module, entity) =>
      catalog.resources.find((r) => r.module === module && r.entity === entity) as Entry,
  });
  return { api, typed, catalog };
}

const detail = () => (
  <ThemeProvider mode="light">
    <ResourceRoute kind="detail" withID />
  </ThemeProvider>
);

beforeEach(() => {
  reset();
  setParams({ module: "task", entity: "task", id: "t-77" });
});

describe("a catalogue entry naming a pack", () => {
  test("that needs a newer shell is drawn generated, with one quiet line, and no typed read", async () => {
    const { api, typed } = serve({ name: "task/tasks", min_shell: SHELL_VERSION + 1 });
    await render(detail());
    expect(await screen.findByTestId("resource-detail")).toBeOnTheScreen();
    expect(screen.queryByTestId("task-detail")).toBeNull();
    expect(screen.getByTestId("shell-update")).toBeOnTheScreen();
    expect(api.get).toHaveBeenCalled();
    expect(typed.calls).toEqual([]);
  });

  test("that this shell can draw is drawn by the pack, with no update line", async () => {
    const { typed } = serve({ name: "task/tasks", min_shell: SHELL_VERSION });
    await render(detail());
    expect(await screen.findByTestId("task-title")).toHaveTextContent(/Calibrate the scale/);
    expect(screen.queryByTestId("shell-update")).toBeNull();
    expect(typed.calls).toEqual(["https://fake.test/api/v1/task/tasks/t-77"]);
  });

  test.each([
    ["a string min_shell", { name: "task/tasks", min_shell: "1" }],
    ["a zero min_shell", { name: "task/tasks", min_shell: 0 }],
    ["an empty name", { name: "", min_shell: 1 }],
    ["null", null],
  ])("written as %s keeps the entry and draws it generated", async (_, renderer) => {
    const { catalog } = serve(renderer);
    expect(catalog.resources).toHaveLength(1);
    expect(catalog.resources[0]?.renderer).toBeUndefined();
    await render(detail());
    expect(await screen.findByTestId("resource-detail")).toBeOnTheScreen();
    expect(screen.queryByTestId("shell-update")).toBeNull();
  });
});
