// What every component test needs: the native modules that have no JavaScript
// implementation under Jest, mocked to their shape so an atom that uses them
// renders. Nothing here asserts; the tests do.
import { jest } from "@jest/globals";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

// The safe area comes from a native provider the router installs at the root;
// under Jest the package's own mock supplies fixed insets.
jest.mock(
  "react-native-safe-area-context",
  () =>
    (jest.requireActual("react-native-safe-area-context/jest/mock") as { default: unknown })
      .default,
);
