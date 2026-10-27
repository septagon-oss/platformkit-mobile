// A refresh never blanks what the list already says (0085): a row's assignee keeps the
// name the directory answered while a refresh asks again, and keeps it when the refresh
// cannot reach the directory at all — a failed request is not a withdrawn grant, so the
// person in a tunnel still reads who a task belongs to. A refusal is a different answer
// and withdraws the name; that rule has its own cases beside the reference hooks.
import React from "react";
import { afterEach, expect, jest, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { parseCatalog, type Entry } from "../../src/core/catalog";
import { ResourceList } from "../../src/screens/ResourceList";
import { ThemeProvider } from "../../src/ui/theme";
import { reset } from "../fakes/router";
import { fakeApi, shell, shellValue, type FakeApi } from "../fakes/shell";
import { unresolved } from "../fakes/unresolved";

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

const MARTA = "5e0c9a7b-2d4f-4b8e-a613-9f2d7c4b1e08";
const task = { id: "71c2e9d4-0b3a-4f6e-8d25-c4a1b7e3f950", title: "Inspect the east bridge" };

/** served mounts the directory and lets the note's rows name their assignee in a cell. */
function served(): { readonly entry: Entry } {
  const doc = unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
  doc.resources[0].fields.push({
    name: "assigneeId",
    type: "uuid",
    presentation: { label: "Assignee", reference: { resource: "user/user" } },
  });
  doc.resources[0].presentation = {
    ...doc.resources[0].presentation,
    summaryFields: ["assigneeId"],
  };
  doc.resources.push({
    module: "user",
    entity: "user",
    path: "/api/v1/user/users",
    screen: "/app/user/users",
    writable: false,
    fields: [
      { name: "id", type: "uuid", readOnly: true },
      { name: "displayName", type: "string" },
    ],
  });
  const catalog = parseCatalog(doc);
  shell.value = { ...shell.value!, state: { phase: "ready", generation: 1, catalog } };
  return { entry: catalog.resources[0]! };
}

function answering(api: FakeApi, directory: () => Promise<unknown>) {
  api.list.mockImplementation((async (e: Entry) =>
    e.module === "user"
      ? directory()
      : { items: [{ ...task, assigneeId: MARTA }], total: 1 }) as never);
}
const notesRead = (api: FakeApi) => api.list.mock.calls.filter(([e]) => e.module !== "user").length;

async function opened(api: FakeApi) {
  reset();
  shell.value = shellValue(api);
  const { entry } = served();
  answering(api, async () => ({ items: [{ id: MARTA, displayName: "Marta Reis" }], total: 1 }));
  await render(
    <ThemeProvider mode="light">
      <ResourceList entry={entry} />
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByText("Marta Reis")).toBeOnTheScreen());
}
async function refreshed(api: FakeApi) {
  const before = notesRead(api);
  await act(async () => {
    fireEvent(screen.getByTestId("resource-list"), "refresh");
  });
  await waitFor(() => expect(notesRead(api)).toBe(before + 1));
}
afterEach(() => {
  shell.value = undefined;
});

test("a refresh that cannot reach the directory keeps the assignee's name", async () => {
  const api = fakeApi();
  await opened(api);
  answering(api, async () => {
    throw new TypeError("Network request failed");
  });
  await refreshed(api);
  await waitFor(() => expect(screen.getByText(task.title)).toBeOnTheScreen());
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText("Marta Reis")).toBeOnTheScreen();
});

test("a refresh keeps the assignee's name while the directory is read again", async () => {
  const api = fakeApi();
  await opened(api);
  let answer: (page: unknown) => void = () => {};
  answering(api, () => new Promise((resolve) => (answer = resolve)));
  await refreshed(api);
  await waitFor(() => expect(screen.getByText(task.title)).toBeOnTheScreen());
  expect(screen.getByText("Marta Reis")).toBeOnTheScreen();
  await act(async () => {
    answer({ items: [{ id: MARTA, displayName: "Marta Reis" }], total: 1 });
  });
});
