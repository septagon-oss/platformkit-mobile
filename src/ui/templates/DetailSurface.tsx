import React from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from "react-native";
import type { SurfaceModel } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
import { Text } from "../atoms/Text";
import { ActionBar } from "../molecules/ActionBar";
import { StateView } from "../molecules/StateView";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
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
    canvas = useCanvas();
  const close = (source: "button" | "back" | "escape" | "gesture") => {
    if (model.canRequestClose) onRequestClose(source);
  };
  const body = (
    <KeyboardAvoidingView
      style={canvas.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      accessibilityViewIsModal={mode === "modal"}
      onAccessibilityEscape={() => close("escape")}
      testID={testID}
    >
      <View style={s.header}>
        <Text role="title" accessibilityRole="header">
          {model.title}
        </Text>
        {model.subtitle ? <Text>{model.subtitle}</Text> : null}
        <ActionControl model={model.close} onAction={() => close("button")} />
        {model.reason ? <Text>{model.reason}</Text> : null}
      </View>
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
