// What a swipe does at each distance: the surface's width is the threshold, a release short of it
// asks nothing of the phone at all, the reveal is clamped to what stands open, one drag is felt once,
// and a reader who asked for less motion runs the same command with less ink. The suite drives the
// fake in tests/fakes/gesture.tsx, which decides these with the same `readSwipe` and the same
// src/ui/scale.ts lengths the product's reanimated surface reads.
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import React from "react";
import { Text } from "react-native";
import type { RowAction } from "../../src/core/derive";
import { hit, space, swipe } from "../../src/ui/scale";
import { RowSwipe, type SwipeHandle } from "../fakes/gesture";

const action: RowAction = {
  verb: "resolve",
  label: "Resolve",
  success: "Resolve done",
  consequence: "",
  destructive: false,
};

/** one row under a finger, and the handle that moves it. */
async function swiped(over: Partial<RowAction> = {}, motion: "normal" | "reduced" = "normal") {
  const onRun = jest.fn<() => void>();
  let handle: SwipeHandle | undefined;
  await render(
    <RowSwipe
      action={{ ...action, ...over }}
      motion={motion}
      onRun={onRun}
      onReady={(h) => (handle = h)}
    >
      <Text>Buy the milk</Text>
    </RowSwipe>,
  );
  if (handle === undefined) throw new Error("the surface never handed out its handle");
  return {
    ran: () => onRun.mock.calls.length,
    drag: async (travel: number) => {
      await act(async () => {
        handle!.drag(travel);
      });
    },
    release: async () => {
      await act(async () => {
        handle!.release();
      });
    },
    open: () => handle!.open(),
    movement: () => handle!.movement(),
  };
}

const tick = jest.mocked(Haptics.impactAsync);

beforeEach(() => {
  tick.mockClear();
});

describe("the threshold", () => {
  test("the width the surface stands open at is the page's fingertip beside its widest gap", async () => {
    expect(swipe.reveal).toBe(hit + space.xl);
    expect(swipe.armX).toBe(space.lg);
    expect(swipe.failY).toBe(space.xl);
  });

  test("a drag one point short of that width uncovers the surface and runs nothing", async () => {
    const row = await swiped();
    await row.drag(swipe.reveal - 1);
    expect(row.open()).toBe(swipe.reveal - 1);
    await row.release();
    // A drag that stopped short is not a request: nothing runs, and the phone says nothing about it.
    expect(row.ran()).toBe(0);
  });

  test("a drag to that width is the command, and a release runs it", async () => {
    const row = await swiped();
    await row.drag(swipe.reveal);
    expect(row.open()).toBe(swipe.reveal);
    await row.release();
    expect(row.ran()).toBe(1);
  });
});

describe("the reveal", () => {
  test("a drag back across the row uncovers nothing, and a long drag uncovers no more than stands open", async () => {
    const row = await swiped();
    await row.drag(-40);
    expect(row.open()).toBe(0);
    await row.drag(1000);
    expect(row.open()).toBe(swipe.reveal);
  });

  test("one drag is felt once, at the crossing and not again on the way back over it", async () => {
    const row = await swiped();
    await row.drag(80);
    await row.drag(120);
    await row.release();
    expect(tick).toHaveBeenCalledTimes(1);
    expect(row.ran()).toBe(1);
  });

  test("a drag that never reached the threshold is felt as nothing", async () => {
    const row = await swiped();
    await row.drag(10);
    await row.release();
    expect(tick).not.toHaveBeenCalled();
  });

  test("a reader who asked for less motion runs the same command, felt the same tick, with no ink easing", async () => {
    const row = await swiped({ destructive: true }, "reduced");
    await row.drag(swipe.reveal);
    await row.release();
    expect(tick).toHaveBeenCalledTimes(1);
    expect(row.ran()).toBe(1);
    expect(row.movement()).toBe("instant");
  });
});
