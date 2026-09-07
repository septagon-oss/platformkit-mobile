// Screen is the chrome every scrolling page shares: the canvas, the scroll
// view that starts under the native header and collapses its large title,
// the safe area at the foot, and, when asked, the keyboard kept off the
// field being edited. A list has its own template.
import React, { type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStyles, useTheme, type Theme } from "../theme";

interface Props {
  readonly children: ReactNode;
  /** form keeps the keyboard off the field being edited and lets a tap land on a control. */
  readonly form?: boolean;
  readonly testID?: string;
}

export function Screen({ children, form = false, testID }: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const insets = useSafeAreaInsets();
  const scroll = (
    <ScrollView
      style={s.page}
      contentContainerStyle={[s.content, { paddingBottom: insets.bottom + t.space.xl }]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps={form ? "handled" : "never"}
      keyboardDismissMode={form ? "interactive" : "none"}
      automaticallyAdjustKeyboardInsets={form && Platform.OS === "ios"}
      {...(testID ? { testID } : {})}
    >
      {children}
    </ScrollView>
  );
  // Android resizes the window for the keyboard (softwareKeyboardLayoutMode in
  // the app config); iOS adjusts the scroll view's insets above. Neither needs
  // the avoiding view, which is kept only for a platform that has neither.
  return form && Platform.OS !== "ios" && Platform.OS !== "android" ? (
    <KeyboardAvoidingView style={s.page} behavior="padding">
      {scroll}
    </KeyboardAvoidingView>
  ) : (
    scroll
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: t.color.surfaceCanvas },
    content: { padding: t.space.lg, gap: t.space.lg },
  });
