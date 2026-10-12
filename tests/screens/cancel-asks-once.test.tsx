// A dirty sheet's Cancel asks "Discard changes?" once. The sheet has two doors
// that can ask it: the header's Cancel, which asks before it leaves, and the
// `usePreventRemove` guard, which a native stack consults for every action that
// would remove the screen — the swipe, the system back, and the `GO_BACK` that
// `router.back()` queues. When Cancel's own "Discard" leaves through `router.back()`
// while the guard is still armed, the stack hands the action to the guard and the
// same question is asked a second time.
//
// The router fake is passive, so this case does the one thing the native stack
// does: a `back()` dispatched while the guard is armed is handed to the guard
// instead of removing the screen. What the person must see is one question and
// one departure.
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useResourceForm } from "../../src/screens/useResourceForm";
import { confirm } from "../../src/ui/chooser";
import { navigation, prevent, reset, router } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const asked = jest.mocked(confirm);

/** The one action the stack would remove this sheet with. */
const action = { type: "GO_BACK" };

beforeEach(() => {
  reset();
  asked.mockClear();
});

describe("a dirty sheet's Cancel", () => {
  test("asks once, and the sheet leaves once", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    // How many times the screen was actually removed, by either door.
    let removed = 0;
    navigation.dispatch.mockImplementation(() => {
      removed += 1;
    });
    // What a native stack does with a back while a guard is armed: it does not
    // remove the screen, it asks the guard, which is what makes a second question
    // possible at all. With the guard lifted, the back removes the screen.
    router.back.mockImplementation(() => {
      if (prevent.enabled) prevent.ask!({ data: { action } });
      else removed += 1;
    });

    const { result } = await renderHook(() => useResourceForm(note, undefined));
    await act(async () => result.current.change("title", "Buy milk"));
    expect(prevent.enabled).toBe(true);

    await act(async () => result.current.cancel());
    // Asked, in the copy table's words. Answering "Discard" is the person's one answer.
    await waitFor(() => expect(asked).toHaveBeenCalled());
    expect(asked.mock.calls[0]![0]).toBe("Discard changes?");
    await act(async () => {
      asked.mock.calls[0]![1].onPress();
    });

    // One question for one Cancel: the departure that "Discard" chose is not handed
    // back to the guard to be asked about again.
    expect(asked).toHaveBeenCalledTimes(1);
    // And the sheet is gone, once, with the shell keeping none of the draft.
    await waitFor(() => expect(removed).toBe(1));
    expect(shell.value!.keep).toHaveBeenLastCalledWith("/note/note/new", {});
  });
});
