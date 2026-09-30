import React from "react";
import { View } from "react-native";
import type { StatModel } from "../../core/derive";
import { Badge } from "../atoms/Badge";
import { Text } from "../atoms/Text";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export function StatTile({ model }: { readonly model: StatModel }) {
  const s = useStyles(kitStyles);
  return (
    <View style={s.panel} accessible>
      <Text role="label" tone="muted">
        {model.label}
      </Text>
      <Text role="display" maxFontSizeMultiplier={0}>
        {model.text}
      </Text>
      {model.delta ? (
        <Badge label={`${model.symbol} ${model.direction}: ${model.delta}`} tone={model.tone} />
      ) : null}
      {model.percent ? <Text>{model.percent}</Text> : null}
      {model.meaning ? <Text>{model.meaning}</Text> : null}
    </View>
  );
}
