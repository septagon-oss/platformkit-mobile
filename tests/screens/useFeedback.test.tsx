import React from "react";
import { StateFeedback } from "../../src/screens/StateFeedback";
import { presentation } from "../fakes/presentation";
import { expect, jest, test } from "@jest/globals";
import { act, renderHook, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { deriveCopy, deriveState } from "../../src/core/derive";
import { useFeedback } from "../../src/screens/useFeedback";
import { useInitialDate } from "../../src/screens/clock";

test("each mounted form samples its explicit clock once, independently of another form", async () => {
  const now = jest
    .fn<() => string>()
    .mockReturnValueOnce("2027-03-15T08:42:00Z")
    .mockReturnValueOnce("2027-03-16T10:05:00Z");
  const first = await renderHook(() => useInitialDate({ now }));
  expect(first.result.current.toISOString()).toBe("2027-03-15T08:42:00.000Z");
  await first.rerender(undefined);
  expect(now).toHaveBeenCalledTimes(1);
  const second = await renderHook(() => useInitialDate({ now }));
  expect(second.result.current.toISOString()).toBe("2027-03-16T10:05:00.000Z");
  expect(first.result.current.toISOString()).toBe("2027-03-15T08:42:00.000Z");
  expect(now).toHaveBeenCalledTimes(2);
});

test("unresolved or failed native preferences stay still; changes beat an older async read", async () => {
  let resolve!: (value: boolean) => void;
  let change!: (value: boolean) => void;
  const remove = jest.fn();
  const read = jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockImplementation(
    () =>
      new Promise<boolean>((done) => {
        resolve = done;
      }),
  );
  const subscribe = jest
    .spyOn(AccessibilityInfo, "addEventListener")
    .mockImplementation((event, listener) => {
      expect(event).toBe("reduceMotionChanged");
      change = listener as unknown as (value: boolean) => void;
      return { remove } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
    });
  try {
    const { result, unmount } = await renderHook(() => useFeedback(deriveCopy("pt")));
    expect(result.current).toMatchObject({
      loadingLabel: "A carregar",
      retryLabel: "Tentar novamente",
      motion: "reduced",
    });
    await act(() => change(true));
    await act(async () => resolve(false));
    expect(result.current.motion).toBe("reduced");
    await act(() => change(false));
    expect(result.current.motion).toBe("normal");
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
    read.mockRejectedValueOnce(new Error("Preference unavailable"));
    const next = await renderHook(() => useFeedback(deriveCopy("en")));
    expect(next.result.current.motion).toBe("reduced");
    await next.unmount();
  } finally {
    read.mockRestore();
    subscribe.mockRestore();
  }
});

test("the iOS screen announces a changed state once and queues only routine messages", async () => {
  const announce = jest
    .spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions")
    .mockImplementation(() => undefined);
  try {
    const success = deriveState({ kind: "success" }, presentation);
    const error = deriveState(
      {
        kind: "error",
        issue: {
          code: "read-failed",
          recovery: "correctable",
          path: "rows",
          message: "Unavailable.",
        },
      },
      presentation,
    );
    if (!success.ok || !error.ok) throw new Error("invalid fixture");
    const view = (model: typeof success.value) =>
      React.createElement(StateFeedback, { model, onAction: () => undefined });
    await render(view(success.value));
    expect(announce).toHaveBeenCalledWith("Done. Your change was saved.", { queue: true });
    await screen.rerender(view({ ...success.value }));
    expect(announce).toHaveBeenCalledTimes(1);
    await screen.rerender(view(error.value));
    expect(announce).toHaveBeenLastCalledWith("This could not be loaded. Unavailable.", {
      queue: false,
    });
    expect(announce).toHaveBeenCalledTimes(2);
  } finally {
    announce.mockRestore();
  }
});
