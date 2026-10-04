import React from "react";
import { StyleSheet, View } from "react-native";
import type { QuantityModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { Notice } from "../atoms/Notice";
import { useStyles, type Theme } from "../theme";
export function QuantityControl({
  model,
  onChange,
}: {
  readonly model: QuantityModel;
  readonly onChange: (value: number) => void;
}) {
  const s = useStyles(styles);
  return (
    <View style={s.stack}>
      <Text role="label">{model.label}</Text>
      <View style={s.row}>
        <Button
          label={model.decreaseWord}
          name={model.decreaseLabel}
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
          label={model.increaseWord}
          name={model.increaseLabel}
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

const styles = (t: Theme) =>
  StyleSheet.create({
    stack: { gap: t.space.md },
    // A stepper is read as one line — less, how many, more — so this row never
    // wraps: a value stranded below its two controls is a number no control
    // visibly belongs to. The word each control prints stays short for the same
    // reason, and announces the full name in its place.
    row: { flexDirection: "row", alignItems: "center", gap: t.space.sm },
  });
