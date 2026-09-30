import React from "react";
import { View } from "react-native";
import type { QuantityModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { Notice } from "../atoms/Notice";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export function QuantityControl({
  model,
  onChange,
}: {
  readonly model: QuantityModel;
  readonly onChange: (value: number) => void;
}) {
  const s = useStyles(kitStyles);
  return (
    <View style={s.stack}>
      <Text role="label">{model.label}</Text>
      <View style={s.row}>
        <Button
          label={model.decreaseLabel}
          tone="secondary"
          disabled={model.decrease === undefined}
          busy={model.state === "busy"}
          onPress={() => {
            if (model.decrease !== undefined) onChange(model.decrease);
          }}
        />
        <Text
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={model.label}
          accessibilityValue={{
            min: model.min,
            max: model.max,
            now: model.value,
            text: model.text,
          }}
          accessibilityActions={[
            ...(model.increase === undefined
              ? []
              : [{ name: "increment" as const, label: model.increaseLabel }]),
            ...(model.decrease === undefined
              ? []
              : [{ name: "decrement" as const, label: model.decreaseLabel }]),
          ]}
          onAccessibilityAction={(event) => {
            const target =
              event.nativeEvent.actionName === "increment"
                ? model.increase
                : event.nativeEvent.actionName === "decrement"
                  ? model.decrease
                  : undefined;
            if (target !== undefined) onChange(target);
          }}
        >
          {model.text}
        </Text>
        <Button
          label={model.increaseLabel}
          tone="secondary"
          disabled={model.increase === undefined}
          busy={model.state === "busy"}
          onPress={() => {
            if (model.increase !== undefined) onChange(model.increase);
          }}
        />
      </View>
      {model.reason ? <Text>{model.reason}</Text> : null}
      {model.issue ? <Notice text={model.issue.message} announcement="urgent" /> : null}
    </View>
  );
}
