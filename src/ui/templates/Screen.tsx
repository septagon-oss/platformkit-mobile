// Screen is the chrome every scrolling page shares: the canvas, the scroll
// view that starts under the native header and collapses its large title,
// the safe area at the foot, and, when asked, the keyboard kept off the
// field being edited. A list has its own template.
import React, { type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useCanvas } from "./canvas";

interface Props {
  readonly children: ReactNode;
  /** form keeps the keyboard off the field being edited and lets a tap land on a control. */
  readonly form?: boolean;
  readonly testID?: string;
}

export function Screen({ children, form = false, testID }: Props) {
  const canvas = useCanvas();
  const scroll = (
    <ScrollView
      style={canvas.page}
      contentContainerStyle={canvas.content}
      // What makes the content start under the native header and the large
      // title collapse as it scrolls.
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets={form && Platform.OS === "ios"}
      keyboardShouldPersistTaps={form ? "handled" : "never"}
      keyboardDismissMode={form ? "interactive" : "none"}
      {...(testID ? { testID } : {})}
    >
      {children}
    </ScrollView>
  );
  // Android resizes the window for the keyboard (softwareKeyboardLayoutMode in
  // the app config); iOS adjusts the scroll view's insets above. Neither needs
  // the avoiding view, which is kept only for a platform that has neither.
  return form && Platform.OS !== "ios" && Platform.OS !== "android" ? (
    <KeyboardAvoidingView style={canvas.page} behavior="padding">
      {scroll}
    </KeyboardAvoidingView>
  ) : (
    scroll
  );
}
