import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { type Entry } from "../../src/core/catalog";
import { useSingleton } from "../../src/screens/useSingleton";
import { reset } from "../fakes/router";
import { fakeApi, note, setting, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

beforeEach(reset);

test.each([
  ["commas", ["North, West", "East"]],
  ["spaces and empty items", [" North ", "", "East"]],
])("a singleton PUT preserves hidden list %s when only its title changes", async (_, tags) => {
  const field = note.fields.find((f) => f.name === "tags")!;
  const entry: Entry = {
    ...setting,
    fields: [
      ...setting.fields.filter((f) => f.name !== "tags"),
      { ...field, hints: { ...field.hints, visibility: "hidden" } },
    ],
  };
  const row = { id: "one", title: "Settings", rank: 4, pinned: true, tags };
  const api = fakeApi();
  api.one.mockResolvedValue(row);
  shell.value = shellValue(api);
  const { result } = await renderHook(() => useSingleton(entry));
  await waitFor(() => expect(result.current.phase).toBe("editing"));
  await act(async () => result.current.edit());
  expect(result.current.blocks.flatMap((b) => b.controls).map((c) => c.field.name)).not.toContain(
    "tags",
  );
  await act(async () => result.current.change("title", "Updated settings"));
  await act(async () => result.current.save());
  expect(api.replace).toHaveBeenCalledTimes(1);
  expect(api.replace.mock.calls[0]![1]).toMatchObject({ title: "Updated settings", tags });
});
