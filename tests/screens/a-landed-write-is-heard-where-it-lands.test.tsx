// A landed write says so on the record the person lands on, and nowhere else. The
// sheet files its sentence under an address it spells itself; the record's hook
// asks the shell for the sentence under the address it spells itself. Two spellings
// of one address, written in two files, is the seam this case pins: what the sheet
// says for a create is heard by the detail of the row the server made, what it says
// for an edit is heard by the detail that was underneath, and a record nobody wrote
// to hears nothing.
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useResourceDetail } from "../../src/screens/useResourceDetail";
import { useResourceForm } from "../../src/screens/useResourceForm";
import { feedback } from "../fakes/presentation";
import { reset } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

/** One slot, keyed by address, consumed on read: the shell's own rule, in the fake. */
function carrier() {
  let filed: { href: string; text: string } | undefined;
  return {
    say: jest.fn((href: string, text: string) => {
      filed = { href, text };
    }),
    heard: jest.fn((href: string) => {
      if (filed?.href !== href) return "";
      const said = filed.text;
      filed = undefined;
      return said;
    }),
  };
}

beforeEach(reset);

describe("what a write said is heard where it lands", () => {
  test("a create's sentence is heard by the record the server made, with the id spelled as a route spells it", async () => {
    const api = fakeApi();
    // An id with a character a route must escape, so the two spellings cannot agree by luck.
    api.create.mockResolvedValue({ id: "a b/c", title: "Buy milk" });
    api.get.mockResolvedValue({ id: "a b/c", title: "Buy milk" });
    const slot = carrier();
    shell.value = shellValue(api, slot);

    const sheet = await renderHook(() => useResourceForm(note, undefined));
    await act(async () => sheet.result.current.change("title", "Buy milk"));
    await act(async () => {
      await sheet.result.current.save();
    });
    await waitFor(() => expect(sheet.result.current.phase).toBe("saved"));
    expect(slot.say).toHaveBeenCalledTimes(1);
    await sheet.unmount();

    // The record the person lands on is the one the router opens with the decoded id.
    const detail = await renderHook(() => useResourceDetail(note, "a b/c", feedback));
    await waitFor(() => expect(detail.result.current.saved).toBe("Note created"));
    // Heard once: the next record to land there hears nothing.
    expect(slot.heard("/note/note/a%20b%2Fc")).toBe("");
  });

  test("an edit's sentence is heard by the record that was underneath, and by no other row", async () => {
    const api = fakeApi();
    api.get.mockResolvedValue({ id: "1", title: "Buy milk" });
    api.update.mockResolvedValue({ id: "1", title: "Buy oat milk" });
    const slot = carrier();
    shell.value = shellValue(api, slot);

    const sheet = await renderHook(() => useResourceForm(note, "1"));
    await waitFor(() => expect(sheet.result.current.phase).toBe("editing"));
    await act(async () => sheet.result.current.change("title", "Buy oat milk"));
    await act(async () => {
      await sheet.result.current.save();
    });
    await waitFor(() => expect(sheet.result.current.phase).toBe("saved"));
    await sheet.unmount();

    // Another row of the same resource hears nothing and consumes nothing.
    const other = await renderHook(() => useResourceDetail(note, "2", feedback));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(note, "2"));
    expect(other.result.current.saved).toBe("");
    await other.unmount();

    const detail = await renderHook(() => useResourceDetail(note, "1", feedback));
    await waitFor(() => expect(detail.result.current.saved).toBe("Changes saved"));
  });
});
