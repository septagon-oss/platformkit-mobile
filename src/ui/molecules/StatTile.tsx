import React from "react";
import { View } from "react-native";
import type { StatModel } from "../../core/derive";
import { Badge } from "../atoms/Badge";
import { Text } from "../atoms/Text";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export interface Props {
  readonly model: StatModel;
  /**
   * framed is whether the tile draws the panel around itself. A caller that owns the
   * surface the number stands on — a card with a shape under it — passes false, so the
   * statistic is not a box inside a box; the words and their order stay this one rule.
   */
  readonly framed?: boolean;
}
export function StatTile({ model, framed = true }: Props) {
  const s = useStyles(kitStyles);
  return (
    <View {...(framed ? { style: s.panel } : {})} accessible>
      <Text role="label" tone="muted">
        {model.label}
      </Text>
      <Text role="display" maxFontSizeMultiplier={0}>
        {model.text}
      </Text>
      {model.deltaLabel ? <Badge label={model.deltaLabel} tone={model.tone} /> : null}
      {model.percent ? <Text>{model.percent}</Text> : null}
      {model.meaning ? <Text>{model.meaning}</Text> : null}
    </View>
  );
}
