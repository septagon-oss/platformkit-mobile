import React from "react";
import { View } from "react-native";
import type { PriceModel } from "../../core/derive";
import { Text } from "./Text";
export function Price({ model }: { readonly model: PriceModel }) {
  return (
    <View accessible accessibilityLabel={model.accessibleLabel}>
      <Text role="caption" tone="muted">
        {model.label}
      </Text>
      <Text role="title" weight="semibold" maxFontSizeMultiplier={0}>
        {model.text}
      </Text>
      {model.compareAt ? (
        <Text tone="muted" style={{ textDecorationLine: "line-through" }}>
          {model.compareAt}
        </Text>
      ) : null}
      {model.unitLabel ? <Text>{model.unitLabel}</Text> : null}
      {model.qualifier ? <Text>{model.qualifier}</Text> : null}
    </View>
  );
}
