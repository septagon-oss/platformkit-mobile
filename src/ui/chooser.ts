// chooser asks the platform to offer a few actions: the action sheet on iOS,
// the alert's buttons elsewhere. It is how a header's "more" menu and the
// account menu are offered without drawing a menu of our own.
import { ActionSheetIOS, Alert, Platform } from "react-native";
import type { Mode } from "./tokens";

export interface Choice {
  readonly label: string;
  readonly onPress: () => void;
  readonly destructive?: boolean;
}

export function choose(title: string, choices: readonly Choice[], mode: Mode): void {
  if (Platform.OS === "ios") {
    const destructive = choices.flatMap((c, i) => (c.destructive ? [i] : []));
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...choices.map((c) => c.label), "Cancel"],
        cancelButtonIndex: choices.length,
        destructiveButtonIndex: destructive.length > 0 ? destructive : null,
        userInterfaceStyle: mode,
      },
      (index) => choices[index]?.onPress(),
    );
    return;
  }
  Alert.alert(title, undefined, [
    ...choices.map((c) => ({
      text: c.label,
      onPress: c.onPress,
      style: c.destructive ? ("destructive" as const) : ("default" as const),
    })),
    { text: "Cancel", style: "cancel" },
  ]);
}
