import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { ApiError } from "../../src/effects/api";
import { useResourceForm } from "../../src/screens/useResourceForm";
import { confirm } from "../../src/ui/chooser";
import { navigation, prevent, reset, router } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const asked = jest.mocked(confirm);

beforeEach(() => {
  reset();
  asked.mockClear();
  jest.mocked(Haptics.notificationAsync).mockClear();
});

describe("useResourceForm", () => {
  test("a create edits at once; an edit reads the row first and cannot save until it has", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const create = await renderHook(() => useResourceForm(note, undefined));
    expect(create.result.current.create).toBe(true);
    expect(create.result.current.phase).toBe("editing");
    expect(api.get).not.toHaveBeenCalled();
    await create.unmount();

    const row = Promise.withResolvers<Record<string, unknown>>();
    api.get.mockReturnValueOnce(row.promise);
    const edit = await renderHook(() => useResourceForm(note, "1"));
    expect(edit.result.current.create).toBe(false);
    expect(edit.result.current.phase).toBe("loading");
    await act(async () => {
      await edit.result.current.save();
    });
    expect(api.update).not.toHaveBeenCalled();
    row.resolve({ id: "1", title: "Buy milk", rank: 2 });
    await waitFor(() => expect(edit.result.current.phase).toBe("editing"));
    const title = edit.result.current.controls.find((c) => c.field.name === "title");
    expect(title?.value).toBe("Buy milk");
  });

  test("what the core refuses never reaches the server, and typing into the field clears the refusal", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(note, undefined));
    await act(async () => result.current.change("rank", "many"));
    await act(async () => {
      await result.current.save();
    });
    expect(api.create).not.toHaveBeenCalled();
    expect(Object.keys(result.current.errors)).toEqual(["rank"]);
    expect(result.current.detail).toBe("Some fields need attention.");
    expect(result.current.phase).toBe("editing");
    await act(async () => result.current.change("rank", "3"));
    expect(result.current.errors).toEqual({});
  });

  test("a create sends what the core makes of the form, counts the write and leaves for the record it wrote", async () => {
    const api = fakeApi();
    api.create.mockResolvedValue({ id: "9", title: "Buy milk" });
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(note, undefined));
    await act(async () => result.current.change("title", "Buy milk"));
    await act(async () => result.current.change("rank", "3"));
    await act(async () => {
      await result.current.save();
    });
    // The number is a number on the wire, not the string that was typed.
    expect(api.create).toHaveBeenCalledWith(
      note,
      expect.objectContaining({ title: "Buy milk", rank: 3 }),
    );
    expect(shell.value!.wrote).toHaveBeenCalledWith("note/note");
    await waitFor(() => expect(result.current.phase).toBe("saved"));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/note/note/9"));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  test("a server refusal lands under its field and keeps the sheet; the corrected edit patches and goes back", async () => {
    const api = fakeApi();
    api.get.mockResolvedValue({ id: "1", title: "Buy milk" });
    api.update.mockRejectedValueOnce(
      new ApiError(422, "a note needs a title", { title: "is required" }),
    );
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(note, "1"));
    await waitFor(() => expect(result.current.phase).toBe("editing"));
    await act(async () => result.current.change("title", ""));
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.phase).toBe("editing");
    expect(result.current.errors).toEqual({ title: "is required" });
    expect(result.current.detail).toBe("a note needs a title");
    expect(router.back).not.toHaveBeenCalled();
    await act(async () => result.current.change("title", "Buy oat milk"));
    await act(async () => {
      await result.current.save();
    });
    expect(api.update).toHaveBeenLastCalledWith(
      note,
      "1",
      expect.objectContaining({ title: "Buy oat milk" }),
    );
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  });

  test("a dirty sheet asks before it is dismissed; a clean one and a saving one do not", async () => {
    const api = fakeApi();
    const saving = Promise.withResolvers<Record<string, unknown>>();
    api.create.mockReturnValueOnce(saving.promise);
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(note, undefined));
    expect(prevent.enabled).toBe(false);
    await act(async () => result.current.change("title", "Buy milk"));
    expect(prevent.enabled).toBe(true);
    const action = { type: "POP" };
    prevent.ask!({ data: { action } });
    expect(navigation.dispatch).not.toHaveBeenCalled();
    const [title, choice, , wording] = asked.mock.calls[0]!;
    expect(title).toBe("Discard changes?");
    expect(choice).toMatchObject({ label: "Discard", destructive: true });
    expect(wording).toEqual({
      message: "What you typed here will be lost.",
      cancel: "Keep editing",
    });
    choice.onPress();
    expect(navigation.dispatch).toHaveBeenCalledWith(action);
    await act(async () => {
      void result.current.save();
    });
    expect(result.current.phase).toBe("saving");
    expect(prevent.enabled).toBe(false);
    saving.resolve({ id: "9" });
    await waitFor(() => expect(result.current.phase).toBe("saved"));
    expect(prevent.enabled).toBe(false);
  });
});
