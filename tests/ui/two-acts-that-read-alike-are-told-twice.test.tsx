// Two acts that read alike are two facts. The bar keeps its sentence when the next command's
// answer happens to be the sentence the first one said — two rows of one list resolved back to back
// both say "Task resolved" — so a surface that re-tells only what changed in its text leaves the
// second act unheard by the reader who cannot see the bar change. What is told is keyed on the
// filing, not on its wording, and this is the one suite that can see the difference: iOS
// announcements are an effect of a mounted surface, so a bar that never remounts never speaks again.
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render, screen, type RenderResult } from "@testing-library/react-native";
import React from "react";
import { AccessibilityInfo } from "react-native";
import { Announcement } from "../../src/screens/Announcement";
import { fakeApi, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
// The bar always speaks while the person is reading it, which is the case that asks whether a
// second filing of the same words is worth a second telling.
jest.mock("../../src/screens/useFeedback", () => ({
  useFeedback: () => ({ ...require("../fakes/presentation").feedback, motion: "reduced" }),
}));

/** one command's own receipt sentence, so the filing and what is listened for cannot drift apart. */
const SAID = "Task resolved";

// The filing, held the way the shell holds it: one sentence at a time, this shell's own count of
// them, and a spent that answers to one token only.
let filing: { sentence: string; token: number } | undefined;
let issued = 0;

beforeEach(() => {
  filing = undefined;
  issued = 0;
  shell.value = shellValue(fakeApi(), {
    report: (sentence: string) => {
      issued += 1;
      filing = { sentence, token: issued };
    },
    reporting: () => filing,
    spent: (token: number) => {
      if (filing?.token === token) filing = undefined;
    },
  });
});

describe("what the bar tells a reader", () => {
  test("a person who acted twice is told twice when both acts read alike", async () => {
    const told = jest.spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions");
    told.mockImplementation(() => undefined);
    // What the bar said about this one sentence — the bar's own announcement, and not whatever
    // else on the page a person may have been told.
    const toldOf = () =>
      told.mock.calls.filter(([text]) => typeof text === "string" && text.endsWith(SAID)).length;
    const act = async (page: RenderResult) => {
      shell.value!.report(SAID);
      // The filing reaches the bar as a render, which is what a write does in the shell for real.
      await page.rerender(<Announcement />);
    };
    const page = await render(<Announcement />);
    expect(toldOf()).toBe(0);
    await act(page);
    const firstTelling = toldOf();
    expect(firstTelling).toBeGreaterThan(0);
    expect(screen.getByText(SAID)).toBeTruthy();
    await act(page);
    expect(toldOf()).toBe(firstTelling * 2);
    told.mockRestore();
  });
});
