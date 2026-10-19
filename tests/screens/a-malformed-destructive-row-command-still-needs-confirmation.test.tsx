// A malformed destructive hint must keep the confirmation between a row action and its write.
// Follow served catalogue bytes through derivation and the command hook, using the shared shell
// and transport doubles; only an explicit affirmative answer may send the command or its receipt.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import { rowAction } from "../../src/core/derive";
import { useRowCommand } from "../../src/screens/useCommand";
import { confirm } from "../../src/ui/chooser";
import { feedback } from "../fakes/presentation";
import { fakeApi, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

afterEach(() => {
  jest.clearAllMocks();
  shell.value = undefined;
});

test.each([null, 0, "false"])(
  "a destructive declaration of %p never becomes an immediate row write",
  async (destructive) => {
    const document = JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
    document.resources[0].presentation = { primaryCommand: "retire" };
    document.resources[0].commands = [
      {
        verb: "retire",
        summary: "Retire the note",
        presentation: { destructive, successMessage: "Note retired" },
      },
    ];
    const notices: string[] = [];
    const entry = parseCatalog(document, (at) => notices.push(at)).resources[0]!;
    const action = rowAction(entry, feedback.copy);
    expect(action?.verb).toBe("retire");
    expect(action?.destructive).toBe(true);
    expect(notices).toContain("resources[0].commands[0].presentation.destructive");

    const api = fakeApi();
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useRowCommand(entry));
    await act(async () => result.current.run("42"));

    expect(api.command).not.toHaveBeenCalled();
    expect(shell.value.wrote).not.toHaveBeenCalled();
    expect(shell.value.report).not.toHaveBeenCalled();
    expect(shell.value.celebrate).not.toHaveBeenCalled();
    const asked = jest.mocked(confirm);
    expect(asked).toHaveBeenCalledTimes(1);
    const [title, answer] = asked.mock.calls[0]!;
    expect(title).toBe("Retire the note");
    expect(answer.destructive).toBe(true);

    await act(async () => answer.onPress());
    expect(api.command).toHaveBeenCalledTimes(1);
    expect(api.command).toHaveBeenCalledWith(entry, "42", "retire");
    expect(shell.value.wrote).toHaveBeenCalledTimes(1);
    expect(shell.value.report).toHaveBeenCalledWith("Note retired");
  },
);
