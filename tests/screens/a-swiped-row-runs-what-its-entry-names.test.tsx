// What a release at the end of a row's swipe does: the command the entry named runs through the
// one submit every other door uses, and is asked first wherever the document says the act hurts or
// says what it does. The receipt it leaves is filed for the person standing at the list — not for
// the record, which says nothing because nothing about it left the screen — and a write this phone
// is holding, or one the server refused, files no receipt at all.
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { Alert } from "react-native";
import { createApi } from "../../src/effects/api";
import { createOutbox } from "../../src/effects/outbox";
import type { OutboxValue } from "../../src/shell";
import { clock, fakeOutboxStore, mint } from "../fakes/store";
import { act, renderHook } from "@testing-library/react-native";
import type { CommandHints, Entry } from "../../src/core/catalog";
import { useRowCommand } from "../../src/screens/useCommand";
import { confirm } from "../../src/ui/chooser";
import { reset } from "../fakes/router";
import { fakeApi, shell, shellValue, note } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const asked = jest.mocked(confirm);

/** The golden's note, given the record verb its rows would be swiped to run. */
function entryDeclaring(verb: string, hints?: CommandHints): Entry {
  return {
    ...note,
    hints: { ...note.hints, primaryCommand: verb },
    commands: [
      ...note.commands,
      {
        ...note.commands[0]!,
        verb,
        summary: "Resolve the note",
        fields: [],
        ...(hints === undefined ? {} : { hints }),
      },
    ],
  };
}

const row = entryDeclaring("resolve");

beforeEach(() => {
  reset();
  asked.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
  shell.value = undefined;
});

describe("a release", () => {
  test("a command that hurts nobody runs at once, and its sentence is filed for the person here", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useRowCommand(row));
    await act(async () => result.current.run("1"));
    await act(async () => undefined);
    expect(asked).not.toHaveBeenCalled();
    expect(api.command).toHaveBeenCalledWith(row, "1", "resolve");
    const said = jest.mocked(shell.value.say);
    // The row stayed on the screen, so the list is who hears it; the record is owed nothing.
    expect(said).toHaveBeenCalledTimes(0);
    expect(jest.mocked(shell.value.report).mock.calls).toEqual([["Resolve done"]]);
    expect(jest.mocked(shell.value.wrote)).toHaveBeenCalledWith("note/note");
  });

  test("the record still hears that this phone wrote here", async () => {
    shell.value = shellValue(fakeApi());
    const { result } = await renderHook(() => useRowCommand(row));
    await act(async () => result.current.run("7"));
    await act(async () => undefined);
    expect(jest.mocked(shell.value.celebrate)).toHaveBeenCalledWith("/note/note/7");
  });

  test("a command that hurts is asked before it runs, and only when the answer is yes", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const hurting = entryDeclaring("resolve", { destructive: true });
    const { result } = await renderHook(() => useRowCommand(hurting));
    await act(async () => result.current.run("1"));
    expect(api.command).not.toHaveBeenCalled();
    const [title, choice] = asked.mock.calls[0]!;
    // The question is the command's own title and its own word, as everywhere else.
    expect(title).toBe("Resolve the note");
    expect(choice.label).toBe("Resolve");
    expect(choice.destructive).toBe(true);
    await act(async () => choice.onPress?.());
    await act(async () => undefined);
    expect(api.command).toHaveBeenCalledWith(hurting, "1", "resolve");
  });

  test("a command whose consequence the author declared is asked, though it hurts nobody", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const declared = entryDeclaring("resolve", {
      confirmation: { body: "Everyone who follows this will be told." },
    });
    const { result } = await renderHook(() => useRowCommand(declared));
    await act(async () => result.current.run("1"));
    expect(api.command).not.toHaveBeenCalled();
    const [, , , wording] = asked.mock.calls[0]!;
    expect(wording?.message).toBe("Everyone who follows this will be told.");
  });

  test("a verb the entry does not offer runs nothing", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useRowCommand(note));
    await act(async () => result.current.run("1"));
    expect(api.command).not.toHaveBeenCalled();
    expect(jest.mocked(shell.value.report)).not.toHaveBeenCalled();
  });

  test("the same row released twice while its write is out is one run", async () => {
    const api = fakeApi();
    let answer: () => void = () => undefined;
    api.command.mockImplementation(() => new Promise((done) => (answer = () => done({ id: "1" }))));
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useRowCommand(row));
    await act(async () => {
      result.current.run("1");
      result.current.run("1");
    });
    expect(api.command).toHaveBeenCalledTimes(1);
    await act(async () => {
      answer();
    });
  });

  test("two rows of one list are two records, and neither is the command being run", async () => {
    const api = fakeApi();
    let answer: () => void = () => undefined;
    api.command.mockImplementation(() => new Promise((done) => (answer = () => done({ id: "1" }))));
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useRowCommand(row));
    await act(async () => {
      result.current.run("1");
      result.current.run("2");
    });
    expect(api.command).toHaveBeenCalledTimes(2);
    await act(async () => {
      answer();
    });
  });

  test("a write this phone is holding has not run, and says nothing in the bar", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const api = fakeApi();
    // The phone is off the network: the queue keeps the command, and the live call never answers.
    api.command.mockRejectedValue(new TypeError("Network request failed"));
    const store = fakeOutboxStore();
    const queue = createOutbox({
      store: store.store,
      api: createApi("https://acme.test", (async () => {
        throw new TypeError("Network request failed");
      }) as typeof fetch),
      clock: clock(),
      mint: mint(),
      scope: () => ({ server: "https://acme.test", userId: "ada" }),
    });
    shell.value = shellValue(api, {
      outbox: {
        items: [],
        submit: queue.submit,
        retry: jest.fn(async () => undefined),
        discard: jest.fn(async () => undefined),
        drain: queue.drain,
      },
    });
    const { result } = await renderHook(() => useRowCommand(row));
    await act(async () => result.current.run("1"));
    await act(async () => undefined);
    expect(jest.mocked(shell.value.report)).not.toHaveBeenCalled();
    expect(jest.mocked(shell.value.wrote)).not.toHaveBeenCalled();
    // The hold is told where it happened, in the hold's own words, and nowhere else.
    expect(alert).toHaveBeenCalledTimes(1);
    expect(String(alert.mock.calls[0]![1])).toMatch(/held/i);
  });

  test("a refusal writes nothing, files nothing and is reported where it happened", async () => {
    const api = fakeApi();
    api.command.mockRejectedValue(new Error("no"));
    const alert = jest
      .spyOn(require("react-native").Alert, "alert")
      .mockImplementation(() => undefined);
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useRowCommand(row));
    await act(async () => result.current.run("1"));
    await act(async () => undefined);
    expect(jest.mocked(shell.value.report)).not.toHaveBeenCalled();
    expect(jest.mocked(shell.value.wrote)).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
  });
});
