import React from "react";
import { View } from "react-native";
import type { SlotOptionModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
export function SlotOption({
  model,
  onSelect,
}: {
  readonly model: SlotOptionModel;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <View>
      <Button
        label={`${model.label} (${model.offset})`}
        tone={model.selected ? "primary" : "secondary"}
        accessibilityRole="radio"
        checked={model.selected}
        disabled={!model.enabled}
        {...(model.reason ? { reason: model.reason } : {})}
        onPress={() => {
          if (model.enabled && !model.selected) onSelect(model.id);
        }}
      />
      <Text>{model.capacity}</Text>
    </View>
  );
}
