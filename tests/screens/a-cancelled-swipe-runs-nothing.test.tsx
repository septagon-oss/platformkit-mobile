// The product's own swipe surface, driven through the callbacks react-native-gesture-handler hands
// it. A release is the moment of decision; a drag the system or a second finger took away is not a
// release. RNGH reports both through `onEnd`, and tells them apart only by its second argument —
// `true` for a gesture that reached END, `false` for one that was CANCELLED or FAILED while active
// (src/handlers/gestures/eventReceiver.ts in the pinned package). So the surface is driven here the
// way the library drives it, with the libraries replaced by the shape of their contract.
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import type { RowAction } from "../../src/core/derive";
import { swipe } from "../../src/ui/scale";
import { RowSwipe } from "../../src/screens/RowSwipe";

type Callback = (...args: unknown[]) => void;
/** The callbacks the surface registered on its pan, by the builder method that registered them. */
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
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: (style: () => unknown) => style(),
    withTiming: (to: unknown) => to,
  };
});
// react-native-worklets refuses to load where no native runtime is loaded, and this suite stands in
// for the crossing it performs: the same call, asked for on the runtime the suite runs on.
jest.mock("react-native-worklets", () => ({
  scheduleOnRN: (f: Callback, ...args: unknown[]) => f(...args),
}));

const action: RowAction = {
  verb: "resolve",
  label: "Resolve",
  success: "Resolve done",
  consequence: "",
  destructive: false,
};

/** a finger that drags the row `travel` toward the trailing edge, past where a release would run. */
async function dragged(travel: number) {
  const onRun = jest.fn<() => void>();
  await render(
    <RowSwipe action={action} motion="normal" onRun={onRun}>
      <Text>Buy the milk</Text>
    </RowSwipe>,
  );
  mockPan.onBegin?.({});
  mockPan.onStart?.({});
  mockPan.onUpdate!({ translationX: -travel });
  return onRun;
}

beforeEach(() => {
  for (const name of Object.keys(mockPan)) delete mockPan[name];
});

describe("the product's swipe surface", () => {
  test("a release past the threshold runs the row's command", async () => {
    const onRun = await dragged(swipe.reveal + 40);
    mockPan.onEnd!({}, true);
    mockPan.onFinalize?.({}, true);
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  test("a drag past the threshold that was cancelled while the finger was down runs nothing", async () => {
    const onRun = await dragged(swipe.reveal + 40);
    mockPan.onEnd!({}, false);
    mockPan.onFinalize?.({}, false);
    expect(onRun).not.toHaveBeenCalled();
  });
});
