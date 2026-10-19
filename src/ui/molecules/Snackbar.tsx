// Snackbar is the receipt of an act the phone took while the person was looking at the list: the
// same rich-state model a screen draws in flow, floated above the surface it happened on. It is
// the timed, elevated half of the `toast` family that src/ui/atoms/Notice.tsx cannot be — Notice
// holds the page's own flow and stays until the screen changes, and a sentence about something
// that just happened needs to leave. It holds no position, no clock and no words: what it says is
// derived where every other state is derived, and who files it, and when it goes away, belong to
// the screen that draws it.
import React, { type ComponentType } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets, type EdgeInsets } from "react-native-safe-area-context";
import type { StateModel } from "../../core/derive";
import { StateView, type Props as StateViewProps } from "./StateView";
import { testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";

export interface Props {
  readonly model: StateModel;
  /** insets is the foot the bar stands above; the root provides them, a test decides them. */
  readonly insets?: EdgeInsets;
  /**
   * renderState is which surface draws the sentence inside the card: the kit's own notice, or the
   * screen wrapper that also tells iOS. The card is the molecule's; announcing is an effect, and an
   * effect belongs to a screen.
   */
  readonly renderState?: ComponentType<StateViewProps>;
  /** beyond the model and the card, nothing: the bar holds no position, no clock and no words. */
  readonly testID?: string;
}

export function Snackbar({ model, insets: given, renderState: State = StateView, testID }: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const fromRoot = useSafeAreaInsets();
  const insets = given ?? fromRoot;
  return (
    <View style={[s.card, { paddingBottom: insets.bottom + t.space.lg }]}>
      <State model={model} onAction={() => undefined} {...testable(testID)} />
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    // The card is the page's own surface raised off the page — the same surface a panel is drawn
    // in, with the shadow a floating strip already wears — so the receipt reads as the app's own
    // line rather than as a second system's alert.
    card: {
      alignSelf: "center",
      width: "100%",
      maxWidth: t.extent.pageColumn,
      padding: t.space.lg,
      marginHorizontal: t.space.lg,
      borderRadius: t.radius.xl,
      backgroundColor: t.color.surfacePrimary,
      ...t.state.raised,
      // Raised twice: the bar stands over the page it was drawn on, which is the one thing a
      // notice in the page's own flow cannot say.
      elevation: t.elevation.floating,
    },
  });
