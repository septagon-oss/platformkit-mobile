import { expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useSingleton } from "../../src/screens/useSingleton";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));

test("cancelling a refused singleton draft allows the next valid edit to save", async () => {
  const entry = { ...note, singleton: true };
  const api = fakeApi();
  api.one.mockResolvedValue({ title: "Original", tags: ["alpha"] });
  api.replace.mockResolvedValue({ title: "Changed", tags: ["alpha"] });
  shell.value = shellValue(api);
  const { result } = await renderHook(() => useSingleton(entry));
  await waitFor(() => expect(result.current.phase).toBe("editing"));
  await act(async () => result.current.edit());
  await act(async () => result.current.fieldRefused("tags", true));
  await act(async () => result.current.save());
  expect(api.replace).not.toHaveBeenCalled();
  await act(async () => result.current.cancel());
  expect(result.current.editing).toBe(false);
  await act(async () => result.current.edit());
  await act(async () => result.current.change("title", "Changed"));
  await act(async () => result.current.save());
  expect(api.replace).toHaveBeenCalledWith(
    entry,
    expect.objectContaining({ title: "Changed", tags: ["alpha"] }),
  );
});
