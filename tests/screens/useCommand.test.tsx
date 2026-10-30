import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { commandTitle, humanize } from "../../src/core/derive";
import { ApiError } from "../../src/effects/api";
import { useCommandAsk, useCommandForm } from "../../src/screens/useCommand";
import { screenCopy } from "../../src/screens/failure";
import { confirm } from "../../src/ui/chooser";
import { navigation, prevent, reset, router } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const asked = jest.mocked(confirm);
// publish takes an argument and opens a sheet; archive takes none and is a question.
const publish = note.commands.find((c) => c.verb === "publish")!;
const archive = note.commands.find((c) => c.verb === "archive")!;

beforeEach(() => {
  reset();
  asked.mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe("useCommandAsk", () => {
  test("a command without an argument is asked in its own words, answered with the same word, and says nothing it was not told; yes runs it and counts the write", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useCommandAsk(note, undefined));
    await act(async () => result.current.ask(archive));
    expect(api.command).not.toHaveBeenCalled();
    const [title, choice, , wording] = asked.mock.calls[0]!;
    expect(title).toBe(commandTitle(archive));
    expect(choice.label).toBe(humanize(archive.verb));
    // Nothing in this document describes what running it does, and the summary is
    // the title, so the question has no sentence under it. The developer's
    // description of the wire member is never spoken to a person.
    expect(wording).toEqual({ message: "" });
    await act(async () => {
      choice.onPress();
    });
    await waitFor(() => expect(api.command).toHaveBeenCalledWith(note, undefined, "archive"));
    // A command about the list has no record to land on, so it files no sentence.
    expect(shell.value!.say).not.toHaveBeenCalled();
    expect(shell.value!.wrote).toHaveBeenCalledWith("note/note");
    expect(result.current.busy).toBe("");
  });

  test("a refusal after yes is reported in the platform's alert, and the row is free again", async () => {
    const api = fakeApi();
    api.command.mockRejectedValueOnce(new ApiError(409, "Nothing to archive."));
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useCommandAsk(note, undefined));
    await act(async () => result.current.ask(archive));
    await act(async () => {
      asked.mock.calls[0]![1].onPress();
    });
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        commandTitle(archive),
        "Archive every resolved note did not run.",
      ),
    );
    expect(shell.value!.wrote).not.toHaveBeenCalled();
    expect(result.current.busy).toBe("");
  });
});

describe("useCommandForm", () => {
  test("a command with an argument runs with what the core makes of it, counts the write and leaves", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useCommandForm(note, "1", publish));
    expect(result.current.blocks.flatMap((b) => b.controls.map((c) => c.field.name))).toEqual([
      "drawing",
      "at",
    ]);
    expect(result.current.phase).toBe("editing");
    await act(async () => result.current.change("at", "2026-02-01T09:00:00Z"));
    await act(async () => {
      await result.current.run();
    });
    expect(api.command).toHaveBeenCalledWith(note, "1", "publish", {
      at: expect.stringMatching(/^2026-02-01T09:00:00/),
    });
    // The sheet leaves, so what it did is filed for the record it ran on, in the
    // words this document's command declared none of — the kit's own frame.
    expect(shell.value!.say).toHaveBeenCalledWith("/note/note/1", "Publish done");
    expect(shell.value!.wrote).toHaveBeenCalledWith("note/note");
    expect(Math.max(...order(shell.value!.say))).toBeLessThan(
      Math.min(...order(shell.value!.wrote)),
    );
    expect(result.current.phase).toBe("ran");
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  test("a refused command keeps the sheet, with the reason under its field", async () => {
    const api = fakeApi();
    api.command.mockRejectedValueOnce(
      new ApiError(422, "Too early.", { at: "must be in the future" }),
    );
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useCommandForm(note, "1", publish));
    await act(async () => result.current.change("at", "2026-02-01T09:00:00Z"));
    await act(async () => {
      await result.current.run();
    });
    expect(result.current.phase).toBe("editing");
    expect(result.current.errors).toEqual({ at: "must be in the future" });
    // A 422 that named its field colours that field and adds no sentence above it.
    expect(result.current.detail).toBe("");
    expect(router.back).not.toHaveBeenCalled();
    expect(shell.value!.wrote).not.toHaveBeenCalled();
  });

  test("a typed argument asks before a swipe discards it; the guard is off while the command runs", async () => {
    const api = fakeApi();
    const running = Promise.withResolvers<Record<string, unknown>>();
    api.command.mockReturnValueOnce(running.promise);
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useCommandForm(note, "1", publish));
    expect(prevent.enabled).toBe(false);
    await act(async () => result.current.change("at", "2026-02-01T09:00:00Z"));
    expect(prevent.enabled).toBe(true);
    const action = { type: "POP" };
    prevent.ask!({ data: { action } });
    const [title, choice, , wording] = asked.mock.calls[0]!;
    // The question is the copy table's — the one every protected form asks, beside the
    // button that reads `discard` from the same table — and so is the sentence saying
    // the command has not run. A literal here would pass over a sheet that answers
    // only in English.
    const copy = screenCopy();
    expect(title).toBe(copy.kit.discardChanges);
    expect(choice).toMatchObject({ label: copy.kit.discard, destructive: true });
    expect(wording).toEqual({
      message: copy.failure.commandNotRun(commandTitle(publish).toLowerCase()),
      cancel: copy.kit.keepEditing,
    });
    choice.onPress();
    expect(navigation.dispatch).toHaveBeenCalledWith(action);
    await act(async () => {
      void result.current.run();
    });
    expect(result.current.phase).toBe("running");
    expect(prevent.enabled).toBe(false);
    running.resolve({ id: "1" });
    await waitFor(() => expect(result.current.phase).toBe("ran"));
  });
});

/** a shell report as the fake recorded it: only the order two of them happened in. */
type Ordered = { readonly mock: { readonly invocationCallOrder: readonly number[] } };
const order = (report: ((...args: never[]) => void) & Partial<Ordered>) => [
  ...(report.mock?.invocationCallOrder ?? []),
];
