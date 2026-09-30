import React from "react";
import { View } from "react-native";
import type { MapLegendModel } from "../../core/derive";
import { Badge } from "../atoms/Badge";
import { Text } from "../atoms/Text";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export function MapLegend({ model }: { readonly model: MapLegendModel }) {
  const s = useStyles(kitStyles);
  return (
    <View style={s.stack}>
      <Text role="label">{model.title}</Text>
      <View style={s.row}>
        {model.entries.map((entry, i) => (
          <Badge key={i} label={entry.label} tone={entry.tone} />
        ))}
      </View>
    </View>
  );
}
