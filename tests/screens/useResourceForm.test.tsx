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
    const title = edit.result.current.blocks
      .flatMap((b) => b.controls)
      .find((c) => c.field.name === "title");
    expect(title?.value).toBe("Buy milk");
  });

  test("what the core refuses never reaches the server, and typing into the field clears the refusal", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(note, undefined));
    // The title is required, and an empty one is refused before anything else is
    // asked about: this case is about the number, so the title holds a value.
    await act(async () => result.current.change("title", "Buy milk"));
    await act(async () => result.current.change("rank", "many"));
    await act(async () => {
      await result.current.save();
    });
    expect(api.create).not.toHaveBeenCalled();
    expect(Object.keys(result.current.errors)).toEqual(["rank"]);
    expect(result.current.detail).toBe("Review the highlighted fields.");
    expect(result.current.phase).toBe("editing");
    // The sheet asks for the field it is waiting on: this one, and no other.
    expect(result.current.awaiting).toBe("rank");
    await act(async () => result.current.change("rank", "3"));
    expect(result.current.awaiting).toBe("");
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
    // The sheet is on its way out, so it files what the write said for the address
    // the person lands on: the new record, in the kit's own words.
    expect(shell.value!.say).toHaveBeenCalledWith("/note/note/9", "Note created");
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
    // A title this person typed is not empty — the phone would have refused that
    // itself — so what colours the field below is the server's own sentence.
    await act(async () => result.current.change("title", "Buy oat milk"));
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.phase).toBe("editing");
    expect(result.current.errors).toEqual({ title: "is required" });
    // A 422 that named its field colours that field and adds no sentence above it.
    expect(result.current.detail).toBe("");
    // and it asks for that field, whichever order the server named its fields in.
    expect(result.current.awaiting).toBe("title");
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

  test("a held value whose list holds a comma never reaches the server", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(note, "1"));
    await waitFor(() => expect(result.current.phase).toBe("editing"));
    await act(async () => result.current.change("title", "Errands"));
    // The box refuses a word with a comma as it is committed, and the form holds
    // only what the box committed. A value that got here another way — a row read
    // from a server that stored one the box would never write — is refused at the
    // save: the sheet sends what the core makes of the held text, and the core
    // refuses a list whose items are spelled with a loose comma.
    await act(async () => result.current.change("tags", "work,home"));
    await act(async () => {
      await result.current.save();
    });
    expect(api.update).not.toHaveBeenCalled();
    expect(result.current.errors).toEqual({ tags: "Remove the comma from this value." });
    // The sheet's own notice, in the kit's words, beside the field it is about.
    expect(result.current.detail).toBe("Review the highlighted fields.");
    expect(router.back).not.toHaveBeenCalled();
    expect(result.current.held.tags).toBe("work,home");
    // A word the person fixes with the keyboard is a value the save accepts again.
    await act(async () => result.current.change("tags", "work home"));
    await act(async () => {
      await result.current.save();
    });
    expect(api.update).toHaveBeenLastCalledWith(
      note,
      "1",
      expect.objectContaining({ tags: ["work home"] }),
    );
  });

  test("a save a field's own box refuses sends nothing and leaves the sheet where it is", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(note, "1"));
    await waitFor(() => expect(result.current.phase).toBe("editing"));
    await act(async () => result.current.change("title", "Errands"));
    // The core cannot see this one: the box holds a word it will not write, and the
    // value the sheet would send is the last one that could be stored. The person's
    // text is on screen and the sheet says nothing went.
    await act(async () => result.current.fieldRefused("tags", true));
    await act(async () => {
      await result.current.save();
    });
    expect(api.update).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("editing");
    expect(result.current.detail).toBe("Review the highlighted fields.");
    expect(router.back).not.toHaveBeenCalled();
    await act(async () => result.current.fieldRefused("tags", false));
    await act(async () => {
      await result.current.save();
    });
    expect(api.update).toHaveBeenCalledTimes(1);
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
      message: "Your changes haven\u2019t been saved.",
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

  test("an empty required title is refused, named, and asked for; everything else stays typed", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(note, undefined));
    await act(async () => result.current.change("body", "Two lines about the same errand"));
    await act(async () => {
      await result.current.save();
    });
    // Nothing left the phone: the sheet refused what it can be certain of.
    expect(api.create).not.toHaveBeenCalled();
    expect(result.current.errors).toEqual({ title: "Enter a title." });
    expect(result.current.detail).toBe("Review the highlighted fields.");
    // The word the sheet asks for is the field the person meets first, and the rest
    // of what was typed is still there to be saved once it is filled in.
    expect(result.current.awaiting).toBe("title");
    expect(result.current.held.body).toBe("Two lines about the same errand");
    expect(result.current.phase).toBe("editing");
  });

  test("a server that failed keeps every word, and says what it knows", async () => {
    const api = fakeApi();
    api.update.mockRejectedValueOnce(new ApiError(500, "HTTP 500 crud: upstream"));
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(note, "1"));
    await waitFor(() => expect(result.current.phase).toBe("editing"));
    await act(async () => result.current.change("title", "Buy milk"));
    await act(async () => result.current.change("body", "from the shop on the corner"));
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.phase).toBe("editing");
    expect(result.current.held).toMatchObject({
      title: "Buy milk",
      body: "from the shop on the corner",
    });
    expect(result.current.detail).toBe("We couldn't save your changes.");
    // A save that failed is not replayed by itself; the person asks again.
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  test("a save nobody answered keeps every word and never sends itself again", async () => {
    const api = fakeApi();
    api.update.mockRejectedValueOnce(new Error("Network request failed"));
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(note, "1"));
    await waitFor(() => expect(result.current.phase).toBe("editing"));
    await act(async () => result.current.change("title", "Buy milk"));
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.phase).toBe("editing");
    expect(result.current.held.title).toBe("Buy milk");
    expect(result.current.detail).toBe("We couldn't confirm whether your changes were saved.");
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  test("typing a value and putting it back is not a change, so nothing is asked", async () => {
    const api = fakeApi();
    api.get.mockResolvedValue({ id: "1", title: "Buy milk" });
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(note, "1"));
    await waitFor(() => expect(result.current.phase).toBe("editing"));
    expect(prevent.enabled).toBe(false);
    // Typed, then reverted to the word the row arrived with.
    await act(async () => result.current.change("title", "Buy milk"));
    expect(prevent.enabled).toBe(false);
    await act(async () => result.current.change("title", "Buy oat milk"));
    expect(prevent.enabled).toBe(true);
    await act(async () => result.current.change("title", "Buy milk"));
    expect(prevent.enabled).toBe(false);
  });
});
