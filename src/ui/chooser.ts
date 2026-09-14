// chooser asks the platform to offer a few actions: the action sheet on iOS,
// the alert's buttons elsewhere. It is how a header's "more" menu and the
// account menu are offered, and how a delete, a discard and a command with no
// argument are confirmed, without drawing a dialog of our own. Every question
// this app asks goes through here, so the way out sits where each platform
// puts it: iOS draws Cancel apart at the foot of the sheet; Android reads the
// dismissive button on the left and the affirmative on the right and keeps at
// most three, so Cancel goes first there and is never the button that is cut.
import { ActionSheetIOS, Alert, Platform } from "react-native";
import type { Mode } from "./tokens";

export interface Choice {
  readonly label: string;
  readonly onPress: () => void;
  readonly destructive?: boolean;
}

/** Wording is what a question says beyond its title and its answers. */
export interface Wording {
  /** message is the sentence under the title: what the answer does, in the API document's words when it has them. */
  readonly message?: string;
  /** cancel is the way out; "Cancel" unless staying is a thing of its own, like "Keep editing". */
  readonly cancel?: string;
}

export function choose(
  title: string,
  choices: readonly Choice[],
  mode: Mode,
  wording: Wording = {},
): void {
  const cancel = wording.cancel ?? "Cancel";
  if (Platform.OS === "ios") {
    const destructive = choices.flatMap((c, i) => (c.destructive ? [i] : []));
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        ...(wording.message ? { message: wording.message } : {}),
        options: [...choices.map((c) => c.label), cancel],
        cancelButtonIndex: choices.length,
        destructiveButtonIndex: destructive.length > 0 ? destructive : null,
        userInterfaceStyle: mode,
      },
      (index) => choices[index]?.onPress(),
    );
    return;
  }
  Alert.alert(title, wording.message, [
    { text: cancel, style: "cancel" },
    ...choices.map((c) => ({
      text: c.label,
      onPress: c.onPress,
      style: c.destructive ? ("destructive" as const) : ("default" as const),
    })),
  ]);
}

/**
 * confirm is one question with one answer: a delete, a discard, a command with
 * no argument. The question is a sentence and the answer is a word, and both
 * are the platform's own dialog rather than a second one drawn here.
 */
export function confirm(title: string, choice: Choice, mode: Mode, wording: Wording = {}): void {
  choose(title, [choice], mode, wording);
}
