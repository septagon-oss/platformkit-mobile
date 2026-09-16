import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { useResourceDetail } from "../../src/screens/useResourceDetail";
import { confirm } from "../../src/ui/chooser";
import { reset, router } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const asked = jest.mocked(confirm);
const felt = jest.mocked(Haptics.notificationAsync);

beforeEach(() => {
  reset();
  asked.mockClear();
  felt.mockClear();
});

describe("useResourceDetail", () => {
  test("the row is read once, and again when this app wrote to the resource while a sheet was above", async () => {
    const api = fakeApi();
    api.get.mockResolvedValue({ id: "1", title: "Buy milk" });
    shell.value = shellValue(api);
    const { result, rerender } = await renderHook(() => useResourceDetail(note, "1"));
    await waitFor(() => expect(result.current.row?.title).toBe("Buy milk"));
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith(note, "1");
    // Nothing was written: coming back reads nothing.
    await rerender(undefined);
    expect(api.get).toHaveBeenCalledTimes(1);
    // A sheet above wrote to the resource: coming back reads the row again.
    shell.value = shellValue(api, { writes: { "note/note": 1 } });
    await rerender(undefined);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  test("a late read cannot overwrite a newer one", async () => {
    const api = fakeApi();
    const first = Promise.withResolvers<Record<string, unknown>>();
    const second = Promise.withResolvers<Record<string, unknown>>();
    api.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceDetail(note, "1"));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    await act(async () => {
      void result.current.reload();
    });
    second.resolve({ id: "1", title: "Newer" });
    await waitFor(() => expect(result.current.row?.title).toBe("Newer"));
    first.resolve({ id: "1", title: "Older" });
    await act(async () => {
      await first.promise;
    });
    expect(result.current.row?.title).toBe("Newer");
    expect(result.current.error).toBe("");
  });

  test("delete asks the platform's question first, then removes, counts the write and leaves", async () => {
    const api = fakeApi();
    api.get.mockResolvedValue({ id: "1", title: "Buy milk" });
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceDetail(note, "1"));
    await waitFor(() => expect(result.current.row).toBeDefined());
    await act(async () => result.current.remove());
    expect(felt).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
    expect(api.remove).not.toHaveBeenCalled();
    expect(asked).toHaveBeenCalledTimes(1);
    const [title, choice, , wording] = asked.mock.calls[0]!;
    expect(title).toBe("Are you sure?");
    expect(choice).toMatchObject({ label: "Delete", destructive: true });
    expect(wording).toEqual({ message: "This deletes the note. It cannot be undone." });
    await act(async () => {
      choice.onPress();
    });
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(api.remove).toHaveBeenCalledWith(note, "1");
    expect(shell.value!.wrote).toHaveBeenCalledWith("note/note");
    expect(felt).toHaveBeenLastCalledWith(Haptics.NotificationFeedbackType.Success);
  });

  test("a refused delete is reported on the screen; a detail with nothing behind it leaves for the list", async () => {
    const api = fakeApi();
    api.get.mockResolvedValue({ id: "1" });
    api.remove.mockRejectedValueOnce(new Error("Not yours to delete."));
    router.canGoBack.mockReturnValue(false);
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceDetail(note, "1"));
    await waitFor(() => expect(result.current.row).toBeDefined());
    await act(async () => result.current.remove());
    await act(async () => {
      asked.mock.calls[0]![1].onPress();
    });
    await waitFor(() => expect(result.current.error).toBe("Not yours to delete."));
    expect(shell.value!.wrote).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => result.current.remove());
    await act(async () => {
      asked.mock.calls[1]![1].onPress();
    });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/note/note"));
    expect(router.back).not.toHaveBeenCalled();
  });
});
