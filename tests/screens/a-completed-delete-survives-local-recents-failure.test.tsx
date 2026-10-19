// A server-confirmed delete stays completed when this device cannot clean up its
// reading history. A local cache error cannot turn that answer into an uncertain
// mutation or keep the deleted record available for another delete.
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError } from "../../src/effects/api";
import { createRecents } from "../../src/effects/recents";
import { useResourceDetail } from "../../src/screens/useResourceDetail";
import { confirm } from "../../src/ui/chooser";
import { feedback } from "../fakes/presentation";
import { reset, router } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";
import { clock, fakeRecentsStore } from "../fakes/store";

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
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const asked = jest.mocked(confirm);

beforeEach(() => {
  reset();
  asked.mockClear();
});

async function deleting(refused = false, storageFails = false) {
  const store = fakeRecentsStore();
  const forget = jest.spyOn(store.store, "forget");
  const recents = createRecents({
    store: store.store,
    clock: clock(),
    scope: () => ({ server: "https://example.test", userId: "ana" }),
  });
  await recents.opened({ resourceKey: "note/note", recordId: "n-17", title: "Planning" });
  if (storageFails) forget.mockRejectedValue(new Error("database is locked"));
  const api = fakeApi();
  api.get.mockResolvedValue({ id: "n-17", title: "Planning" });
  if (refused) api.remove.mockRejectedValue(new ApiError(403, "forbidden"));
  shell.value = shellValue(api, { recents });
  const hook = await renderHook(() => useResourceDetail(note, "n-17", feedback));
  await waitFor(() => expect(hook.result.current.row?.id).toBe("n-17"));
  await act(async () => hook.result.current.remove());
  const question = asked.mock.calls.at(-1)?.[1];
  if (!question?.onPress) throw new Error("the delete has no confirmation action");
  await act(async () => question.onPress?.());
  return { api, recents, forget, hook };
}

describe("a completed delete and this device's reading history", () => {
  test("a confirmed delete leaves the record even when forgetting its recent open fails", async () => {
    const { api, forget, hook } = await deleting(false, true);
    expect(api.remove).toHaveBeenCalledTimes(1);
    expect(forget).toHaveBeenCalledTimes(1);
    expect(shell.value!.wrote).toHaveBeenCalledWith("note/note");
    expect({ back: router.back.mock.calls.length, error: hook.result.current.error }).toEqual({
      back: 1,
      error: "",
    });
  });

  test("a confirmed delete withdraws its recent open and leaves the record", async () => {
    const { recents, hook } = await deleting();
    expect(await recents.list()).toEqual([]);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(hook.result.current.error).toBe("");
  });

  test("a refused delete keeps its recent open and records no successful write", async () => {
    const { recents, forget, hook } = await deleting(true);
    expect((await recents.list()).map((recent) => recent.recordId)).toEqual(["n-17"]);
    expect(forget).not.toHaveBeenCalled();
    expect(shell.value!.wrote).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
    expect(hook.result.current.error).not.toBe("");
  });
});
