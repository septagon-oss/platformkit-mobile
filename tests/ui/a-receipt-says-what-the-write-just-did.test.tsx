// The life of the bar: filed, drawn, read as what a write just did, and spent — by its own clock,
// and by the filing that replaced it. The words are the command's own and the state around them is
// `deriveState`'s, so the receipt is not a second success surface with rules of its own; the shell
// holds the filing, so navigating away from where it happened cannot take it back.
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render, screen, type RenderResult } from "@testing-library/react-native";
import React from "react";
import { Announcement } from "../../src/screens/Announcement";
import { fakeApi, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
// The motion preference decides whether the bar eases out or simply stops being drawn, so the
// suite holds it rather than waiting for a device to answer.
const mockMotion = { current: "reduced" as "normal" | "reduced" };
jest.mock("../../src/screens/useFeedback", () => ({
  useFeedback: () => ({
    ...require("../fakes/presentation").feedback,
    motion: mockMotion.current,
  }),
}));

// The filing, held the way the shell holds it: one sentence at a time, this shell's own count of
// them, and a spent that answers to one token only.
let filing: { sentence: string; token: number } | undefined;
let issued = 0;

beforeEach(() => {
  jest.useFakeTimers();
  filing = undefined;
  issued = 0;
  mockMotion.current = "reduced";
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

afterEach(() => {
  jest.useRealTimers();
  shell.value = undefined;
});

/** the bar on the page the person is standing on. */
const standing = async (): Promise<RenderResult> => await render(<Announcement />);

/** the person acted, and the shell filed what it did. */
const acted = async (page: RenderResult, sentence: string) => {
  shell.value!.report(sentence);
  // The filing reaches the bar as a render, which is what a write does in the shell for real:
  // the same act that files it counts the write, and every screen holding the shell redraws.
  await page.rerender(<Announcement />);
};

/** the person stops looking at it for `ms`, and the page is drawn again as it would be. */
const wait = async (page: RenderResult, ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await page.rerender(<Announcement />);
};

const shown = () => screen.queryByTestId("snackbar") !== null;

describe("the bar's life", () => {
  test("nothing is owed the person until a write files something", async () => {
    await standing();
    expect(shown()).toBe(false);
  });

  test("a filing is drawn where the person is standing, in the words the command gave", async () => {
    const page = await standing();
    await acted(page, "Task resolved");
    expect(shown()).toBe(true);
    expect(screen.getByText("Task resolved")).toBeTruthy();
  });

  test("it is gone at its own four seconds, and is still there one before", async () => {
    const page = await standing();
    await acted(page, "Task resolved");
    await wait(page, 3999);
    expect(shown()).toBe(true);
    await wait(page, 1);
    expect(shown()).toBe(false);
  });

  test("a phone that asks for motion is owed the same four seconds and an easing out", async () => {
    mockMotion.current = "normal";
    const page = await standing();
    await acted(page, "Task resolved");
    await wait(page, 4000);
    // The fade is the leaving, not the reading: the sentence was never held up by it.
    expect(shown()).toBe(true);
    await wait(page, 220);
    expect(shown()).toBe(false);
  });

  test("the newest act replaces the sentence and starts its own clock", async () => {
    const page = await standing();
    await acted(page, "Task resolved");
    await wait(page, 2000);
    await acted(page, "Note published");
    expect(screen.getByText("Note published")).toBeTruthy();
    expect(screen.queryByText("Task resolved")).toBeNull();
    await wait(page, 2000);
    expect(shown()).toBe(true);
    await wait(page, 2000);
    expect(shown()).toBe(false);
  });

  test("a clock kept by a bar that was replaced closes nothing", async () => {
    const page = await standing();
    await acted(page, "Task resolved");
    await acted(page, "Note published");
    const stale = issued - 1;
    act(() => {
      shell.value!.spent(stale);
    });
    await page.rerender(<Announcement />);
    expect(shown()).toBe(true);
    expect(screen.getByText("Note published")).toBeTruthy();
  });

  test("a session that is going away is owed no receipt at all", async () => {
    const page = await standing();
    await acted(page, "Task resolved");
    // What the shell's `forget` does to this slot, and to the sentence and the draft beside it.
    filing = undefined;
    await page.rerender(<Announcement />);
    expect(shown()).toBe(false);
  });
});
