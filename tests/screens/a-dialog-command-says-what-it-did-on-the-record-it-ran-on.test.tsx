// A command with no argument is a question in the platform's dialog, and when it
// is asked from a record's own screen the record is what hears the answer: the
// sentence the command leaves behind is filed at that record's address, in the
// kit's own frame when the document declared none, and it is filed before the
// write is counted — the record screen hears the sentence in the same focus that
// reconciles the write, so a later filing would be a sentence nobody reads.
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { commandTitle } from "../../src/core/derive";
import { ApiError } from "../../src/effects/api";
import { useCommandAsk } from "../../src/screens/useCommand";
import { confirm } from "../../src/ui/chooser";
import { reset } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const asked = jest.mocked(confirm);
// The golden's one argument-less verb stands in for a row command: the hook reads
// the command's words and the address it was asked at, not where the document
// mounts the verb.
const archive = note.commands.find((c) => c.verb === "archive")!;

/** when is the order two shell reports happened in, as the fake recorded it. */
const when = (report: { mock: { invocationCallOrder: readonly number[] } }) => [
  ...report.mock.invocationCallOrder,
];

beforeEach(() => {
  reset();
  asked.mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
  shell.value = undefined;
});

describe("useCommandAsk on a record", () => {
  test("yes files the kit's success line at the record's address before the write is counted", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useCommandAsk(note, "1"));
    await act(async () => result.current.ask(archive));
    const [title, choice] = asked.mock.calls[0]!;
    expect(title).toBe(commandTitle(archive));
    expect(choice.label).toBe("Archive");
    await act(async () => {
      choice.onPress();
    });
    await waitFor(() => expect(api.command).toHaveBeenCalledWith(note, "1", "archive"));
    const say = jest.mocked(shell.value!.say);
    const wrote = jest.mocked(shell.value!.wrote);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledWith("/note/note/1", "Archive done");
    expect(wrote).toHaveBeenCalledWith("note/note");
    expect(Math.max(...when(say))).toBeLessThan(Math.min(...when(wrote)));
    expect(result.current.busy).toBe("");
  });

  test("a refused command files no sentence and counts no write", async () => {
    const api = fakeApi();
    api.command.mockRejectedValueOnce(new ApiError(409, "Nothing to archive."));
    jest.spyOn(require("react-native").Alert, "alert").mockImplementation(() => undefined);
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useCommandAsk(note, "1"));
    await act(async () => result.current.ask(archive));
    await act(async () => {
      asked.mock.calls[0]![1].onPress();
    });
    await waitFor(() => expect(result.current.busy).toBe(""));
    expect(shell.value!.say).not.toHaveBeenCalled();
    expect(shell.value!.wrote).not.toHaveBeenCalled();
  });
});
