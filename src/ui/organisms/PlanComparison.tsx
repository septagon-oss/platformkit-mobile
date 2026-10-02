import React from "react";
import { View } from "react-native";
import type { PlanComparisonModel } from "../../core/derive";
import { Text } from "../atoms/Text";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
import { PricingTiers, type Props } from "./PricingTiers";
/** One projection owns the offers; comparison presents feature-first rows. */
export function PlanComparison({
  model,
  ...events
}: Omit<Props, "model"> & {
  readonly model: PlanComparisonModel;
}) {
  const s = useStyles(kitStyles);
  return (
    <View style={s.stack}>
      <PricingTiers model={model} {...events} />
      {model.features.map((feature) => (
        <View key={feature.id} style={s.panel}>
          <Text role="title" accessibilityRole="header">
            {feature.label}
          </Text>
          {feature.description ? <Text>{feature.description}</Text> : null}
          {feature.values.map((value) => (
            <View key={value.planId} accessible accessibilityLabel={value.accessibleLabel}>
              <Text role="label" weight="semibold">
                {value.planTitle}
              </Text>
              <Text>{value.text}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
