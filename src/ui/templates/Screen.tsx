// Screen is the chrome every scrolling page shares: the canvas, the scroll
// view that starts under the native header and collapses its large title,
// the safe area at the foot, and, when asked, the keyboard kept off the
// field being edited. A list has its own template.
import React, { type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useCanvas } from "./canvas";
import { testable } from "../props";

interface Props {
  readonly children: ReactNode;
  /** form keeps the keyboard off the field being edited and lets a tap land on a control. */
  readonly form?: boolean;
  readonly scroll?: boolean;
  /**
   * scrollViewRef is this page's scroll view, for the one thing only the page knows how
   * to ask of it: bringing the field a refusal is about above the keyboard. The template
   * holds no rule about which field that is — it hands out the handle and the organism
   * decides — and React Native's own `scrollResponderScrollNativeHandleToKeyboard` does
   * the measuring.
   */
  readonly scrollViewRef?: React.Ref<ScrollView>;
  readonly testID?: string;
}

export function Screen({
  children,
  form = false,
  scroll: scrolling = true,
  scrollViewRef,
  testID,
}: Props) {
  const canvas = useCanvas();
  if (!scrolling)
    return (
      <View style={[canvas.page, canvas.content]} {...testable(testID)}>
        {children}
      </View>
    );
  const scroll = (
    <ScrollView
      ref={scrollViewRef}
      style={canvas.page}
      contentContainerStyle={canvas.content}
      // What makes the content start under the native header and the large
      // title collapse as it scrolls.
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets={form && Platform.OS === "ios"}
      keyboardShouldPersistTaps={form ? "handled" : "never"}
      keyboardDismissMode={form ? "interactive" : "none"}
      {...testable(testID)}
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
