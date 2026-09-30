import React from "react";
import { View } from "react-native";
import type { PricingModel } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
import { Badge } from "../atoms/Badge";
import { Button } from "../atoms/Button";
import { Price } from "../atoms/Price";
import { Text } from "../atoms/Text";
import { Notice } from "../atoms/Notice";
import { ChoiceChips } from "../molecules/ChoiceChips";
import { ModelState } from "../molecules/ModelState";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export interface Props {
  readonly model: PricingModel;
  readonly onPeriod: (id: string) => void;
  readonly onSelect: (id: string) => void;
  readonly onAction: (value: {
    readonly planId: string;
    readonly periodId: string;
    readonly actionId: string;
  }) => void;
  readonly onRetry: () => void;
}
export function PricingTiers({ model, onPeriod, onSelect, onAction, onRetry }: Props) {
  const s = useStyles(kitStyles);
  return (
    <View style={s.stack}>
      <ChoiceChips
        model={model.periods}
        onChange={(id) => {
          if (id) onPeriod(id);
        }}
      />
      <ModelState model={model} onRetry={onRetry} />
      {model.selectionIssue ? (
        <Notice text={model.selectionIssue.message} announcement="polite" />
      ) : null}
      {model.plans.map((plan) => (
        <View key={plan.id} style={[s.panel, plan.selected && s.selected]}>
          <Text role="title" accessibilityRole="header">
            {plan.title}
          </Text>
          {plan.description ? <Text>{plan.description}</Text> : null}
          {plan.badge ? <Badge label={plan.badge.label} tone={plan.badge.tone} /> : null}
          {plan.current ? <Badge label={plan.current} /> : null}
          {plan.offer?.price ? <Price model={plan.offer.price} /> : null}
          {plan.offer?.contact ? <Text>{plan.offer.contact}</Text> : null}
          {plan.reason ? <Text>{plan.reason}</Text> : null}
          {plan.features.map((feature) => (
            <Text key={feature.id} accessibilityLabel={feature.accessibleLabel}>
              {feature.label}: {feature.text}
            </Text>
          ))}
          <Button
            label={plan.selectLabel}
            tone="secondary"
            selected={plan.selected}
            disabled={!plan.enabled}
            onPress={() => {
              if (plan.enabled && !plan.selected) onSelect(plan.id);
            }}
          />
          {plan.offer?.action ? (
            <ActionControl
              model={plan.offer.action}
              onAction={(actionId) => onAction({ ...plan.target, actionId })}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}
