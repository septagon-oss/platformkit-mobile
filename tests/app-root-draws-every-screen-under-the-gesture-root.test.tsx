// The composition root draws the navigator, and with it every screen, under one gesture root. A
// row's swipe surface is a `GestureDetector`, and react-native-gesture-handler recognizes no
// gesture outside a `GestureHandlerRootView` (in a development build it refuses to render one);
// the native stack supplies none, so the root has to. Under Jest that refusal is switched off, so
// the only way a suite sees the root is to ask the tree the layout draws.
import { describe, expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import Layout from "../app/_layout";

jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  return {
    GestureHandlerRootView: ({ children }: { children?: unknown }) =>
      require("react").createElement(View, { testID: "gesture-root" }, children),
  };
});
jest.mock("expo-router", () => {
  const { View } = require("react-native");
  const { createElement } = require("react");
  const Stack = ({ children }: { children?: unknown }) =>
    createElement(View, { testID: "stack" }, children);
  return {
    Stack: Object.assign(Stack, { Screen: () => null }),
    // The notification tap navigates, so it asks the router for the same fake every other
    // screen under test is handed; without it the composition root cannot mount.
    useRouter: () => require("./fakes/router").router,
  };
});
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("expo-system-ui", () => ({ setBackgroundColorAsync: jest.fn(async () => undefined) }));
// The native media and the device's own stores cannot be evaluated where no native runtime is
// loaded; what is under test is where the layout draws them, not what they do.
jest.mock("../src/screens/DeckMotion", () => ({ DeckMotion: () => null }));
jest.mock("../src/screens/RowSwipe", () => ({ RowSwipe: () => null }));
jest.mock("../src/screens/NativeZoom", () => ({ NativeZoom: () => null }));
jest.mock("../src/screens/CoverMotion", () => ({ CoverMotion: () => null }));
jest.mock("../src/screens/FinishingMotion", () => ({ FinishingMotion: () => null }));
jest.mock("../src/screens/Announcement", () => ({ Announcement: () => null }));
jest.mock("../src/screens/device", () => ({ device: {} }));
jest.mock("../src/shell", () => ({
  Shell: ({ children }: { children?: unknown }) => children,
  useShell: () => {
    const { fakeApi, shellValue } = require("./fakes/shell");
    return shellValue(fakeApi());
  },
}));

/** under says whether `node` is drawn inside an element carrying `testID`. */
function under(node: ReturnType<typeof screen.getByTestId>, testID: string): boolean {
  for (let at = node.parent; at !== null; at = at.parent)
    if (at.props.testID === testID) return true;
  return false;
}

describe("the composition root", () => {
  test("draws the navigator, and every screen in it, under one gesture root", async () => {
    await render(<Layout />);
    const stack = screen.getByTestId("stack");
    expect(screen.queryAllByTestId("gesture-root")).toHaveLength(1);
    expect(under(stack, "gesture-root")).toBe(true);
  });
});
