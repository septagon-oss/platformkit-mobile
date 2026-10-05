import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { SurfaceModel } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
import { Text } from "../atoms/Text";
import { ActionBar } from "../molecules/ActionBar";
import { StateView } from "../molecules/StateView";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
import type { Theme } from "../theme";
import { useCanvas } from "./canvas";
export interface DetailSurfaceProps {
  readonly model: SurfaceModel;
  readonly children?: React.ReactNode;
  readonly onAction?: (id: string) => void;
  readonly onRequestClose: (source: "button" | "back" | "escape" | "gesture") => void;
  readonly onPresented?: () => void;
  readonly onClosed?: () => void;
  readonly testID?: string | undefined;
}
export function DetailSurface({
  model,
  children,
  onAction,
  onRequestClose,
  onPresented,
  onClosed,
  testID,
  mode = "modal",
}: { readonly mode?: "modal" | "docked" } & DetailSurfaceProps) {
  const s = useStyles(kitStyles),
    own = useStyles(surfaceStyles),
    canvas = useCanvas();
  // Which column the sheet's own surface holds. `canvas.page` says what ink its
  // words are drawn in and fills whatever it is given; here it is told how wide a
  // surface a phone's sheet is — see sheetColumn in layout.ts for why a device and
  // a browser answer that differently.
  const column: StyleProp<ViewStyle> = s.sheetColumn;
  const close = (source: "button" | "back" | "escape" | "gesture") => {
    if (model.canRequestClose) onRequestClose(source);
  };
  const body = (
    <KeyboardAvoidingView
      style={[canvas.page, column]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      accessibilityViewIsModal={mode === "modal"}
      onAccessibilityEscape={() => close("escape")}
      testID={testID}
    >
      <View style={own.header}>
        {/* The close control belongs at the edge the title ends at, not on a row of
            its own: a sheet that opens with a full-width band tells the person to
            leave before it has shown them what it holds. */}
        <View style={own.headline}>
          <Text role="title" accessibilityRole="header">
            {model.title}
          </Text>
          {model.subtitle ? <Text>{model.subtitle}</Text> : null}
        </View>
        <ActionControl model={model.close} onAction={() => close("button")} />
      </View>
      {model.reason ? (
        <View style={s.header}>
          <Text>{model.reason}</Text>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={canvas.content} keyboardShouldPersistTaps="handled">
        {model.state ? (
          <StateView model={model.state} onAction={(id) => onAction?.(id)} />
        ) : (
          children
        )}
      </ScrollView>
      <View style={[s.footer, canvas.footer]}>
        <ActionBar model={model.bar} {...(onAction ? { onAction } : {})} />
      </View>
    </KeyboardAvoidingView>
  );
  return mode === "docked" ? (
    model.open ? (
      body
    ) : null
  ) : (
    <Modal
      visible={model.open}
      presentationStyle="pageSheet"
      animationType="none"
      onShow={onPresented}
      onDismiss={onClosed}
      onRequestClose={() => close("back")}
      allowSwipeDismissal={false}
    >
      {body}
    </Modal>
  );
}

/**
 * A sheet's header is one row: what the surface is called, and the way out of it,
 * at the same glance. Stacking them cost the title its prominence and gave a
 * dismissed surface the widest control on the screen.
 */
const surfaceStyles = (t: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      gap: t.space.sm,
      paddingHorizontal: t.space.lg,
      paddingTop: t.space.lg,
      paddingBottom: t.space.sm,
    },
    headline: { flex: 1, gap: t.space.xs },
  });
