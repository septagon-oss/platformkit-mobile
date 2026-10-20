// The production pan bridges only a current, armed single-pointer release and ticks at most once per drag.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import * as Haptics from "expo-haptics";
import { DeckMotion } from "../../src/screens/DeckMotion";
import type { DeckMotionProps } from "../../src/ui/organisms/ResourceDeck";

type Callback = (...args: unknown[]) => void;
const mockPan: Record<string, Callback> = {};
jest.mock("react-native-gesture-handler", () => {
  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_, name: string) => (arg: unknown) => {
        if (typeof arg === "function") mockPan[name] = arg as Callback;
        return builder;
      },
    },
  );
  return {
    Gesture: { Pan: () => builder },
    GestureDetector: ({ children }: { children: unknown }) => children,
  };
});
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  const React = require("react");
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (initial: unknown) =>
      React.useState(() => {
        let value = initial;
        return {
          get: () => value,
          set: (next: unknown) => {
            value = next;
          },
        };
      })[0],
    useDerivedValue: (read: () => unknown) => ({ get: read }),
    useAnimatedStyle: (read: () => unknown) => read(),
    cancelAnimation: () => undefined,
    withTiming: (to: unknown) => to,
    withSpring: (to: unknown) => to,
  };
});
jest.mock("react-native-worklets", () => ({
  scheduleOnRN: (fn: Callback, ...args: unknown[]) => fn(...args),
}));
beforeEach(() => {
  jest.clearAllMocks();
  for (const name of Object.keys(mockPan)) delete mockPan[name];
});
async function mounted(over: Partial<DeckMotionProps> = {}) {
  const onChoose = jest.fn<(direction: string, operation?: number) => void>();
  const props: DeckMotionProps = {
    available: ["left", "down", "up", "right"],
    overlays: [],
    motion: "normal",
    transition: undefined,
    operation: 8,
    onChoose,
    onSettled: jest.fn(),
    children: <Text>Card</Text>,
    ...over,
  };
  const view = await render(<DeckMotion {...props} />);
  await fireEvent(screen.getByTestId("deck-surface"), "layout", {
    nativeEvent: { layout: { width: 360, height: 640 } },
  });
  return { ...view, onChoose, props };
}
const position = (x: number, y = 0, pointers = 1) => ({
  translationX: x,
  translationY: y,
  numberOfPointers: pointers,
});

test("crossing, retreating and crossing again ticks once and only release selects the current direction", async () => {
  const { onChoose } = await mounted();
  await act(async () => {
    mockPan.onBegin!();
    for (const x of [119, 120, 80, 130, -130]) mockPan.onUpdate!(position(x));
    expect(onChoose).not.toHaveBeenCalled();
    mockPan.onEnd!(position(-130), true);
    mockPan.onEnd!(position(-130), true);
  });
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(onChoose).toHaveBeenCalledTimes(1);
  expect(onChoose).toHaveBeenCalledWith("left", 8);
});

test.each(["short", "cancelled", "extra-pointer", "resized"])(
  "a %s gesture never bridges a choice",
  async (kind) => {
    const { onChoose } = await mounted();
    await act(async () => {
      mockPan.onBegin!();
      mockPan.onUpdate!(position(130));
    });
    if (kind === "resized")
      await fireEvent(screen.getByTestId("deck-surface"), "layout", {
        nativeEvent: { layout: { width: 400, height: 640 } },
      });
    await act(async () => {
      if (kind === "extra-pointer") mockPan.onUpdate!(position(130, 0, 2));
      mockPan.onEnd!(position(kind === "short" ? 80 : 130), kind !== "cancelled");
      mockPan.onFinalize!();
    });
    expect(onChoose).not.toHaveBeenCalled();
  },
);

test("reduced motion retains the threshold tick and the same release action", async () => {
  const { onChoose } = await mounted({ motion: "reduced" });
  await act(async () => {
    mockPan.onBegin!();
    mockPan.onUpdate!(position(0, -160));
    mockPan.onEnd!(position(0, -160), true);
  });
  expect(onChoose).toHaveBeenCalledWith("up", 8);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
});

test("changing motion preference cancels the drag that was already armed", async () => {
  const view = await mounted();
  await act(async () => {
    mockPan.onBegin!();
    mockPan.onUpdate!(position(130));
  });
  await view.rerender(<DeckMotion {...view.props} motion="reduced" />);
  await act(async () => mockPan.onEnd!(position(130), true));
  expect(view.onChoose).not.toHaveBeenCalled();
});
