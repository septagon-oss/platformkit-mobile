import React from "react";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import type { Entry } from "../../src/core/catalog";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
import { ResourceList } from "../../src/screens/ResourceList";
import { useResourceForm } from "../../src/screens/useResourceForm";
import { ThemeProvider } from "../../src/ui/theme";
import { header, reset } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

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

const api = fakeApi();
const readOnly: Entry = { ...note, operations: ["list", "read"] };
const view = (child: React.ReactElement) => <ThemeProvider mode="light">{child}</ThemeProvider>;

beforeEach(() => {
  reset();
  jest.clearAllMocks();
  api.get.mockResolvedValue({ id: "17", title: "A saved title" });
  shell.value = shellValue(api);
});

test("a mounted list withdraws both create controls when its catalogue changes", async () => {
  const rendered = await render(view(<ResourceList entry={note} />));
  await waitFor(() => expect(screen.getByRole("button", { name: /^New / })).toBeOnTheScreen());
  expect(screen.getByRole("button", { name: "New" })).toBeOnTheScreen();
  await rendered.rerender(view(<ResourceList entry={readOnly} />));
  expect(screen.getByRole("button", { name: "Order" })).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "New" })).toBeNull();
  expect(screen.queryByRole("button", { name: /^New / })).toBeNull();
  await rendered.rerender(view(<ResourceList entry={note} />));
  expect(screen.getByRole("button", { name: "New" })).toBeOnTheScreen();
});

test("a mounted record clears Edit and Delete when its catalogue withdraws writes", async () => {
  const rendered = await render(view(<ResourceDetail entry={note} id="17" />));
  await waitFor(() => expect(screen.getByTestId("record-menu")).toBeOnTheScreen());
  await fireEvent.press(screen.getByTestId("record-menu"));
  await waitFor(() => expect(screen.getByTestId("delete")).toBeOnTheScreen());
  expect(screen.getByRole("button", { name: "Edit" })).toBeOnTheScreen();
  await rendered.rerender(view(<ResourceDetail entry={readOnly} id="17" />));
  // Both doors went with the catalogue: no Edit, and no `…` left to hold a Delete
  // the resource no longer mounts.
  expect(screen.queryByTestId("delete")).toBeNull();
  expect(screen.queryByTestId("record-menu")).toBeNull();
  expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  expect(header.options?.headerRight).toBeInstanceOf(Function);
  expect(header.options?.headerRight?.()).toBeNull();
});

test("an open edit form refuses a withdrawn update without sending or counting a write", async () => {
  const form = await renderHook(({ entry }: { entry: Entry }) => useResourceForm(entry, "17"), {
    initialProps: { entry: note },
  });
  await waitFor(() => expect(form.result.current.phase).toBe("editing"));
  await act(async () => form.result.current.change("title", "Unsaved title"));
  await form.rerender({ entry: readOnly });
  await act(async () => form.result.current.save());
  expect(form.result.current.phase).toBe("editing");
  expect(form.result.current.detail).toBe("This record cannot be edited here.");
  expect(api.update).not.toHaveBeenCalled();
  expect(api.create).not.toHaveBeenCalled();
  expect(shell.value!.wrote).not.toHaveBeenCalled();
  // Reopening the operation uses the same hook and preserves the pending edit.
  await form.rerender({ entry: note });
  await act(async () => form.result.current.save());
  expect(api.update).toHaveBeenCalledWith(
    note,
    "17",
    expect.objectContaining({ title: "Unsaved title" }),
  );
  expect(shell.value!.wrote).toHaveBeenCalledTimes(1);
});
