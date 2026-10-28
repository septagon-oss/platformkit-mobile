// The sheet a stepped entry opens is walked, not scrolled: one step's boxes at a time, the
// rail in the server's words, Next wearing the step's own verb, a step refused on its own
// answer, a write only at the last step's door, and a refusal from the server returning the
// person to the step that was asked for it.
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { parseCatalog } from "../../src/core/catalog";
import type { Entry } from "../../src/core/catalog";
import { useResourceForm } from "../../src/screens/useResourceForm";
import { confirm } from "../../src/ui/chooser";
import { ApiError } from "../../src/effects/api";
import { navigation, prevent, reset } from "../fakes/router";
import { fakeApi, shell, shellValue } from "../fakes/shell";
import { steppedNote } from "../fakes/steps";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const asked = jest.mocked(confirm);

/**
 * stepped is the kernel's note record with the kernel's three-step create form resolved on
 * it (`tests/fakes/steps.ts`), read through this phone's own catalogue door: the steps below
 * are the ones a server printed, not ones this file wrote.
 */
const stepped = (): Entry => parseCatalog(steppedNote(), () => {}).resources[0]!;

beforeEach(() => {
  reset();
  asked.mockClear();
});

describe("a stepped sheet", () => {
  test("one step is on the screen at a time, and Next wears the step's own verb", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(stepped(), undefined));
    expect(result.current.stepped).toBe(true);
    expect(result.current.stages.map((s) => [s.id, s.label])).toEqual([
      ["unsectioned", "Details"],
      ["section:details", "Description"],
      ["section:options", "Options"],
    ]);
    expect(result.current.at).toBe("unsectioned");
    // The words the step chose for itself, not the kit's "Next": the answer the person
    // has not given yet is the step's own empty label.
    const words = result.current.stepperWords("editing");
    expect(words.steps[0]?.primary).toBe("Enter a title");
    expect(words.steps[2]?.primary).toBe("Save note");
    // Next with the answer the step owes still owed: nobody moves, nothing is sent.
    await act(async () => result.current.next());
    expect(result.current.at).toBe("unsectioned");
    expect(result.current.errors).toEqual({ title: expect.any(String) });
    expect(result.current.detail).toBe("Review the highlighted fields.");
    expect(api.create).not.toHaveBeenCalled();

    await act(async () => result.current.change("title", "Autumn notes"));
    expect(result.current.stepperWords("editing").steps[0]?.primary).toBe("Next · Autumn notes");
    await act(async () => result.current.next());
    expect(result.current.at).toBe("section:details");
    expect(result.current.stages[0]?.completion).toBe("complete");
    // Back is a step move: no question, the answers intact, the step it left complete.
    await act(async () => result.current.back());
    expect(result.current.at).toBe("unsectioned");
    expect(asked).not.toHaveBeenCalled();
    expect(result.current.held.title).toBe("Autumn notes");
  });

  test("a server that refuses a field of the first step sends the walk back there", async () => {
    const api = fakeApi();
    api.create.mockRejectedValueOnce(
      new ApiError(422, "the note is not complete", {
        title: "is taken",
        tags: "holds no such tag",
      }),
    );
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(stepped(), undefined));
    await act(async () => result.current.change("title", "Autumn notes"));
    await act(async () => result.current.next());
    await act(async () => result.current.change("body", "Terracotta, ivory"));
    await act(async () => result.current.next());
    expect(result.current.at).toBe("section:options");
    await act(async () => {
      await result.current.save();
    });
    // One request, one walk: the two sentences the server named belong to steps one and
    // three, and the person is standing at the first of them with everything typed intact.
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(result.current.at).toBe("unsectioned");
    expect(result.current.errors).toEqual({ title: "is taken", tags: "holds no such tag" });
    expect(result.current.held).toMatchObject({ title: "Autumn notes", body: "Terracotta, ivory" });
    expect(result.current.phase).toBe("editing");
    await waitFor(() => expect(result.current.stages[0]?.completion).toBe("incomplete"));
  });

  test("the last step's verb writes the whole row, and the sheet does not ask who is left behind", async () => {
    const api = fakeApi();
    api.create.mockResolvedValue({ id: "note-9", title: "Autumn notes" });
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(stepped(), undefined));
    await act(async () => result.current.change("title", "Autumn notes"));
    await act(async () => result.current.next());
    await act(async () => result.current.change("body", "Terracotta, ivory"));
    await act(async () => result.current.next());
    expect(api.create).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.save();
    });
    expect(api.create).toHaveBeenCalledTimes(1);
    // One body for the whole sheet, the last step's verb having been the only door: the
    // fields the walk never showed are in it exactly as a flat sheet would have sent them.
    const body = api.create.mock.calls[0]![1] as Record<string, unknown>;
    expect(body.title).toBe("Autumn notes");
    expect(body.body).toBe("Terracotta, ivory");
    expect(result.current.phase).toBe("saved");
  });

  test("leaving from a later step is a step back; leaving from the first one asks once", async () => {
    const api = fakeApi();
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useResourceForm(stepped(), undefined));
    // The first step, nothing typed: the sheet lets itself be dismissed unasked.
    expect(prevent.enabled).toBe(false);
    await act(async () => result.current.change("title", "Autumn notes"));
    expect(prevent.enabled).toBe(true);
    await act(async () => result.current.next());
    // A later step: the same gesture is a step back, and no discard question is asked.
    await act(async () => prevent.ask!({ data: { action: "dismiss" } }));
    expect(result.current.at).toBe("unsectioned");
    expect(asked).not.toHaveBeenCalled();
    expect(navigation.dispatch).not.toHaveBeenCalled();
    // Back on the first step with something to lose, it asks the one question it always asked.
    await act(async () => result.current.back());
    await act(async () => prevent.ask!({ data: { action: "dismiss" } }));
    expect(asked).toHaveBeenCalledTimes(1);
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });
});
