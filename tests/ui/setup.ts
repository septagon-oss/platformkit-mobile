// What every component test needs: the native modules that have no JavaScript
// implementation under Jest, mocked to their shape so an atom that uses them
// renders. Nothing here asserts; the tests do.
import { jest } from "@jest/globals";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
