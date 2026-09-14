import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { ActionSheetIOS, Alert, Platform } from "react-native";
import { choose, confirm } from "../../src/ui/chooser";

describe("chooser", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("on iOS a question is the action sheet: the sentence under the title, the destructive answer marked, the way out apart", () => {
    const sheet = jest
      .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
      .mockImplementation(() => undefined);
    const onPress = jest.fn();
    confirm("Are you sure?", { label: "Delete", destructive: true, onPress }, "dark", {
      message: "This deletes the note. It cannot be undone.",
    });
    expect(sheet).toHaveBeenCalledTimes(1);
    const [options, answer] = sheet.mock.calls[0]!;
    expect(options).toEqual({
      title: "Are you sure?",
      message: "This deletes the note. It cannot be undone.",
      options: ["Delete", "Cancel"],
      cancelButtonIndex: 1,
      destructiveButtonIndex: [0],
      userInterfaceStyle: "dark",
    });
    answer(1);
    expect(onPress).not.toHaveBeenCalled();
    answer(0);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("elsewhere it is the alert, the way out first where Android reads the dismissive button", () => {
    jest.replaceProperty(Platform, "OS", "android");
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const discard = jest.fn();
    confirm(
      "Discard changes?",
      { label: "Discard", destructive: true, onPress: discard },
      "light",
      {
        message: "What you typed here will be lost.",
        cancel: "Keep editing",
      },
    );
    expect(alert).toHaveBeenCalledWith("Discard changes?", "What you typed here will be lost.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: discard },
    ]);
    // A menu of several keeps Cancel first too: Android shows at most three
    // buttons, and the one it would cut is the last.
    choose(
      "Account",
      [
        { label: "Refresh", onPress: jest.fn() },
        { label: "Sign out", onPress: jest.fn(), destructive: true },
      ],
      "light",
    );
    const [, message, buttons] = alert.mock.calls[1]!;
    expect(message).toBeUndefined();
    expect(buttons!.map((b) => [b.text, b.style])).toEqual([
      ["Cancel", "cancel"],
      ["Refresh", "default"],
      ["Sign out", "destructive"],
    ]);
  });
});
