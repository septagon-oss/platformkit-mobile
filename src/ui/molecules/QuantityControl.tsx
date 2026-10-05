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
  // One line, read left to right: what is being counted, then less, how many,
  // more. The two halves print a glyph each because the same act wears the same
  // glyph on every screen, while the name they announce still carries the whole
  // sentence — "Decrease Adults" — in the language the screen was asked for.
  return (
    <View style={s.stack}>
      <View style={s.line}>
        <Text role="label">{model.label}</Text>
        <View style={s.row}>
          <Button
            label=""
            name={model.decreaseLabel}
            icon="less"
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
            aria-valuemin={model.min}
            aria-valuemax={model.max}
            aria-valuenow={model.value}
            aria-valuetext={model.text}
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
            label=""
            name={model.increaseLabel}
            icon="add"
            tone="secondary"
            disabled={model.increase === undefined}
            busy={model.state === "busy"}
            onPress={() => {
              if (model.increase !== undefined) onChange(model.increase);
            }}
          />
        </View>
      </View>
      {model.reason ? <Text>{model.reason}</Text> : null}
      {model.issue ? <Notice text={model.issue.message} announcement="urgent" /> : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    stack: { gap: t.space.xs },
    // The count sits beside the thing it counts, and its two controls beside the
    // count: a number under its own heading, two rows of buttons below it, reads
    // as a form field rather than as one control.
    line: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.space.md,
    },
    // A stepper is read as one line — less, how many, more — so this row never
    // wraps: a value stranded below its two controls is a number no control
    // visibly belongs to.
    row: { flexDirection: "row", alignItems: "center", gap: t.space.sm },
  });
