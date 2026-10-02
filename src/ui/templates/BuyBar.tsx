import React from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import type { BuyBarModel } from "../../core/derive";
import { Price } from "../atoms/Price";
import { Text } from "../atoms/Text";
import { ActionBar } from "../molecules/ActionBar";
import { StateView } from "../molecules/StateView";
import { kitStyles } from "../layout";
import { useCanvas } from "./canvas";
import { useStyles } from "../theme";
export function BuyBar({
  model,
  onAction,
}: {
  readonly model: BuyBarModel;
  readonly onAction: (id: string) => void;
}) {
  const s = useStyles(kitStyles),
    canvas = useCanvas();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.footer, canvas.footer]}>
        {model.notice ? <StateView model={model.notice} onAction={onAction} /> : null}
        <Price model={model.price} />
        {model.quantity ? <Text>{model.quantity}</Text> : null}
        <ActionBar model={model.bar} onAction={onAction} />
      </View>
    </KeyboardAvoidingView>
  );
}
