// canvas.ts is what every template's page is made of, written once: the
// canvas colour behind it, the content inset and rhythm, and the safe area at
// the foot so the last row clears the home indicator. A scrolling page and a
// list are the same page.
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStyles, useTheme, type Theme } from "../theme";

export interface Canvas {
  /** page fills the screen with the canvas colour. */
  readonly page: StyleProp<ViewStyle>;
  /** content insets what is drawn and keeps its foot above the safe area. */
  readonly content: StyleProp<ViewStyle>;
}

export function useCanvas(): Canvas {
  const t = useTheme();
  const s = useStyles(styles);
  const insets = useSafeAreaInsets();
  return { page: s.page, content: [s.content, { paddingBottom: insets.bottom + t.space.xl }] };
}

const styles = (t: Theme) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: t.color.surfaceCanvas },
    content: { padding: t.space.lg, gap: t.space.lg },
  });
