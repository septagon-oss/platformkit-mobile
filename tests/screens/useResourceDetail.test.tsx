import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { useResourceDetail } from "../../src/screens/useResourceDetail";
import { ApiError } from "../../src/effects/api";
import { feedback } from "../fakes/presentation";
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
    const { result, rerender } = await renderHook(() => useResourceDetail(note, "1", feedback));
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

  test("what a write said is said for the visit it landed in, and a visit that heard nothing says nothing", async () => {
    const api = fakeApi();
    api.get.mockResolvedValue({ id: "1", title: "Buy milk" });
    // One sentence filed under this record's address and consumed on read: the
    // shell's own rule, held here so the case can say what the second focus hears.
    let filed = "Changes saved";
    const heard = jest.fn((at: string) => {
      if (at !== "/note/note/1" || filed === "") return "";
      const said = filed;
      filed = "";
      return said;
    });
    shell.value = shellValue(api, { heard });
    const { result, rerender } = await renderHook(() => useResourceDetail(note, "1", feedback));
    await waitFor(() => expect(result.current.saved).toBe("Changes saved"));
    // A sheet opened from this record and dismissed without writing: the focus that
    // comes back hears nothing, so the sentence about an earlier write goes with the
    // visit it was heard in instead of staying under the row for the session.
    shell.value = shellValue(api, { heard });
    await rerender(undefined);
    await waitFor(() => expect(result.current.saved).toBe(""));
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  test("a late read cannot overwrite a newer one", async () => {
    const api = fakeApi();
    const first = Promise.withResolvers<Record<string, unknown>>();
    const second = Promise.withResolvers<Record<string, unknown>>();
    api.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceDetail(note, "1", feedback));
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
    const { result } = await renderHook(() => useResourceDetail(note, "1", feedback));
    await waitFor(() => expect(result.current.row).toBeDefined());
    await act(async () => result.current.remove());
    expect(felt).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
    expect(api.remove).not.toHaveBeenCalled();
    expect(asked).toHaveBeenCalledTimes(1);
    const [title, choice, , wording] = asked.mock.calls[0]!;
    // 0085's question: the record by the name it is called everywhere, the warning
    // that says what this app cannot do, and an answer that names the act.
    expect(title).toBe("Delete ‘Buy milk’?");
    expect(choice).toMatchObject({ label: "Delete note", destructive: true });
    expect(wording).toEqual({
      message: "You can’t undo this in the app.",
      cancel: feedback.copy.kit.cancel,
    });
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
    api.remove.mockRejectedValueOnce(new Error("Network request failed"));
    router.canGoBack.mockReturnValue(false);
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceDetail(note, "1", feedback));
    await waitFor(() => expect(result.current.row).toBeDefined());
    await act(async () => result.current.remove());
    await act(async () => {
      asked.mock.calls[0]![1].onPress();
    });
    // An unanswered delete is not a failed one: the phone says it could not tell.
    await waitFor(() =>
      expect(result.current.error).toBe("We couldn't confirm whether your changes were saved."),
    );
    const said = result.current.refusal;
    expect(said && said.outcome === "notice" ? said.code : "").toBe("write-unknown");
    expect(said && said.outcome === "notice" ? said.action : "").toBe("reconcile");
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

  test("a refresh answered 403 withdraws the record and says the access went", async () => {
    const api = fakeApi();
    api.get.mockResolvedValueOnce({ id: "1", title: "Buy milk" });
    shell.value = shellValue(api);
    const { result, rerender } = await renderHook(() => useResourceDetail(note, "1", feedback));
    await waitFor(() => expect(result.current.row?.title).toBe("Buy milk"));
    api.get.mockRejectedValueOnce(new ApiError(403, "not yours"));
    // Coming back to a record this app wrote to is a refresh, not a first read.
    shell.value = shellValue(api, { writes: { "note/note": 1 } });
    await rerender(undefined);
    await waitFor(() =>
      expect(result.current.error).toBe("You no longer have access to this item."),
    );
    expect(result.current.row).toBeUndefined();
    const said = result.current.refusal;
    expect(said && said.outcome === "notice" ? said.code : "").toBe("forbidden");
    expect(said && said.outcome === "notice" ? said.action : "").toBe("back");
  });

  test("a refresh answered 503 keeps the record and says when it was last read", async () => {
    const api = fakeApi();
    api.get.mockResolvedValueOnce({ id: "1", title: "Buy milk" });
    shell.value = shellValue(api);
    const { result, rerender } = await renderHook(() => useResourceDetail(note, "1", feedback));
    await waitFor(() => expect(result.current.row?.title).toBe("Buy milk"));
    api.get.mockRejectedValueOnce(new ApiError(503, "upstream"));
    shell.value = shellValue(api, { writes: { "note/note": 1 } });
    await rerender(undefined);
    await waitFor(() => expect(result.current.error).toMatch(/^Couldn't refresh\./));
    expect(result.current.row?.title).toBe("Buy milk");
    const said = result.current.refusal;
    expect(said && said.outcome === "notice" ? said.action : "").toBe("retry");
  });

  test("a request the screen abandoned says nothing at all", async () => {
    const api = fakeApi();
    api.get.mockResolvedValueOnce({ id: "1", title: "Buy milk" });
    shell.value = shellValue(api);
    const { result, rerender } = await renderHook(() => useResourceDetail(note, "1", feedback));
    await waitFor(() => expect(result.current.row?.title).toBe("Buy milk"));
    const abandoned = new Error("The request was cancelled.");
    abandoned.name = "AbortError";
    api.get.mockRejectedValueOnce(abandoned);
    shell.value = shellValue(api, { writes: { "note/note": 1 } });
    await rerender(undefined);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.error).toBe("");
    expect(result.current.row?.title).toBe("Buy milk");
  });
});
