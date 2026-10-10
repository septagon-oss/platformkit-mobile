// A singleton is one row, written with a PUT of the whole of it, and its form is
// drawn on the same screen as the record — so the protections the create and edit
// sheet has must be re-decided here rather than assumed. These cases are those
// decisions: Edit exists only once the row has been read and Save rechecks that
// from inside; a dirty draft is thrown away only after the person says so, by
// button, by system back and by the swipe alike; what the phone can refuse it
// refuses in a sentence and never sends; every value survives a 422, a 500 and a
// transport that never answered; the PUT carries every writable field the read
// returned, hidden and immutable ones included, and none the server owns; and the
// one row it wrote says so in words, once.
import React from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { key, type Entry } from "../../src/core/catalog";
import { ApiError } from "../../src/effects/api";
import { Singleton } from "../../src/screens/Singleton";
import { useSingleton } from "../../src/screens/useSingleton";
import { confirm } from "../../src/ui/chooser";
import { ThemeProvider } from "../../src/ui/theme";
import { header, navigation, prevent, reset, router } from "../fakes/router";
import { fakeApi, setting, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const asked = jest.mocked(confirm);

/**
 * hidden is the served `setting` entry with one field's visibility mutated, the way
 * `a-form-asks-only-what-a-person-can-answer` mutates its document: the fixture's
 * bytes are sha-pinned, so a case that needs a hidden field says which one.
 */
function hidden(e: Entry, name: string): Entry {
  return {
    ...e,
    fields: e.fields.map((f) =>
      f.name === name ? { ...f, hints: { ...(f.hints ?? {}), visibility: "hidden" as const } } : f,
    ),
  };
}

const row = { id: "one", title: "Site settings", rank: 4, pinned: true };

async function open(entry: Entry) {
  const api = fakeApi();
  api.one.mockResolvedValue({ ...row });
  api.replace.mockResolvedValue({ ...row, title: "Site settings, renamed" });
  shell.value = shellValue(api);
  const view = await renderHook(() => useSingleton(entry));
  await waitFor(() => expect(view.result.current.phase).toBe("editing"));
  return { api, view, result: view.result };
}

beforeEach(() => {
  reset();
  asked.mockClear();
  jest.mocked(Haptics.notificationAsync).mockClear();
});

describe("useSingleton", () => {
  test("a dirty draft asks before it is thrown away, and stays when told to keep editing", async () => {
    const { api, result } = await open(setting);
    await act(async () => result.current.edit());
    await act(async () => result.current.change("title", "A name nobody approved"));
    await act(async () => result.current.cancel());
    // Asked, in the copy table's words, and nothing changed underneath.
    const [title, choice, , wording] = asked.mock.calls[0]!;
    expect(title).toBe("Discard changes?");
    expect(choice).toMatchObject({ label: "Discard", destructive: true });
    expect(wording).toEqual({
      message: "Your changes haven’t been saved.",
      cancel: "Keep editing",
    });
    expect(result.current.editing).toBe(true);
    expect(result.current.held.title).toBe("A name nobody approved");
    expect(api.replace).not.toHaveBeenCalled();
    // "Keep editing" is the way out, and it leaves the draft where it was.
    result.current.cancel();
    expect(asked).toHaveBeenCalledTimes(2);
    await act(async () => {
      asked.mock.calls[1]![1].onPress();
    });
    expect(result.current.editing).toBe(false);
    expect(result.current.held).toEqual({});
    // The record underneath is still the row that was read.
    expect(result.current.row).toMatchObject({ title: "Site settings" });
  });

  test("a swipe away from a dirty draft is asked about too, and dispatches only when discarded", async () => {
    const { result } = await open(setting);
    expect(prevent.enabled).toBe(false);
    await act(async () => result.current.edit());
    // Open but untouched: nothing to lose, so nothing to ask.
    expect(prevent.enabled).toBe(false);
    await act(async () => result.current.change("title", "Different"));
    expect(prevent.enabled).toBe(true);
    const action = { type: "POP" };
    prevent.ask!({ data: { action } });
    expect(navigation.dispatch).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(true);
    await act(async () => {
      asked.mock.calls[0]![1].onPress();
    });
    expect(navigation.dispatch).toHaveBeenCalledWith(action);
    expect(result.current.editing).toBe(false);
  });

  test("typing a value and putting it back asks for no answer at all", async () => {
    const { result } = await open(setting);
    await act(async () => result.current.edit());
    await act(async () => result.current.change("title", "Site settings"));
    expect(prevent.enabled).toBe(false);
    await act(async () => result.current.cancel());
    expect(asked).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(false);
  });

  test("a PUT carries the hidden field it read and none the server owns", async () => {
    const entry = hidden(setting, "rank");
    const { api, result } = await open(entry);
    await act(async () => result.current.edit());
    const drawn = result.current.blocks.flatMap((b) => b.controls).map((c) => c.field.name);
    // A field the author hid stays out of the sheet — and still in the row.
    expect(drawn).not.toContain("rank");
    await act(async () => result.current.change("title", "Renamed by hand"));
    await act(async () => {
      await result.current.save();
    });
    expect(api.replace).toHaveBeenCalledTimes(1);
    const body = api.replace.mock.calls[0]![1] as Record<string, unknown>;
    expect(body).toMatchObject({ rank: 4, pinned: true, title: "Renamed by hand" });
    // The server's own three never travel back in a body that replaces a row.
    expect(body.id).toBeUndefined();
    expect(body.createdAt).toBeUndefined();
    expect(body.updatedAt).toBeUndefined();
  });

  test("what the phone refuses never reaches the server, and names the field it is waiting on", async () => {
    const { api, result } = await open(setting);
    await act(async () => result.current.edit());
    await act(async () => result.current.change("title", ""));
    await act(async () => {
      await result.current.save();
    });
    expect(api.replace).not.toHaveBeenCalled();
    expect(result.current.errors).toEqual({ title: "Enter a title." });
    expect(result.current.detail).toBe("Review the highlighted fields.");
    expect(result.current.awaiting).toBe("title");
    expect(result.current.phase).toBe("editing");
    // A second Save over the same unamended draft asks for the same field again: the
    // name is unchanged, so the sheet counts its refusals to have something to ask by.
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.awaiting).toBe("title");
    expect(result.current.refusals).toBe(2);
  });

  test("a failed read draws no Edit, and a save with no row sends nothing", async () => {
    const api = fakeApi();
    api.one.mockRejectedValue(new ApiError(500, "HTTP 500 crud: upstream"));
    shell.value = shellValue(api);
    await act(async () => {
      await render(
        <ThemeProvider mode="light">
          <Singleton entry={setting} />
        </ThemeProvider>,
      );
    });
    await waitFor(() => expect(screen.getByTestId("refusal")).toBeOnTheScreen());
    // The door is not drawn greyed; it is not drawn. A PUT of a row this app never
    // read would be a write over a record nobody has seen.
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(header.options?.headerRight).toBeInstanceOf(Function);
    expect(header.options?.headerRight?.()).toBeNull();
    // The other half of the same rule, from inside the transition.
    const hook = await renderHook(() => useSingleton(setting));
    await waitFor(() => expect(hook.result.current.phase).toBe("failed"));
    await act(async () => {
      await hook.result.current.save();
    });
    expect(api.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  test("a landed PUT says what landed, once, with one haptic", async () => {
    const { api, result } = await open(setting);
    await act(async () => result.current.edit());
    await act(async () => result.current.change("title", "Renamed by hand"));
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.saved).toBe("Changes saved");
    expect(result.current.editing).toBe(false);
    expect(result.current.held).toEqual({});
    expect(result.current.row).toMatchObject({ title: "Site settings, renamed" });
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
    expect(shell.value!.wrote).toHaveBeenCalledWith(key(setting));
    // Opening the form again is the end of the sentence: the record says what its
    // write did once, not on every look at it afterwards.
    await act(async () => result.current.edit());
    expect(result.current.saved).toBe("");
  });

  test("values survive every failure, and each says what it knows", async () => {
    // A 422 that named a field puts the server's own words under that field, asks
    // for it, and adds no second sentence above it.
    const field = await open(setting);
    await act(async () => field.result.current.edit());
    field.api.replace.mockRejectedValueOnce(
      new ApiError(422, "a setting needs a title", { title: "is required" }),
    );
    await act(async () => field.result.current.change("title", "Renamed by hand"));
    await act(async () => {
      await field.result.current.save();
    });
    expect(field.result.current.held.title).toBe("Renamed by hand");
    expect(field.result.current.errors).toEqual({ title: "is required" });
    expect(field.result.current.detail).toBe("");
    expect(field.result.current.awaiting).toBe("title");
    expect(field.result.current.phase).toBe("editing");

    // A server that failed says it could not save, and does not send itself again.
    const failed = await open(setting);
    failed.api.replace.mockRejectedValueOnce(new ApiError(500, "HTTP 500 crud: upstream"));
    await act(async () => failed.result.current.edit());
    await act(async () => failed.result.current.change("title", "Renamed by hand"));
    await act(async () => {
      await failed.result.current.save();
    });
    expect(failed.result.current.held.title).toBe("Renamed by hand");
    expect(failed.result.current.detail).toBe("We couldn't save your changes.");
    expect(failed.api.replace).toHaveBeenCalledTimes(1);

    // A transport that never answered says the honest thing: nothing is known.
    const silent = await open(setting);
    silent.api.replace.mockRejectedValueOnce(new Error("Network request failed"));
    await act(async () => silent.result.current.edit());
    await act(async () => silent.result.current.change("title", "Renamed by hand"));
    await act(async () => {
      await silent.result.current.save();
    });
    expect(silent.result.current.held.title).toBe("Renamed by hand");
    expect(silent.result.current.detail).toBe(
      "We couldn't confirm whether your changes were saved.",
    );
    expect(silent.result.current.editing).toBe(true);
    expect(silent.api.replace).toHaveBeenCalledTimes(1);
  });
});
