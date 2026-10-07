import React from "react";
import { StyleSheet, View } from "react-native";
import type { ChoiceGroupModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Notice } from "../atoms/Notice";
import { Text } from "../atoms/Text";
import { kitStyles } from "../layout";
import { useStyles, type Theme } from "../theme";
export function ChoiceChips({
  model,
  onChange,
  testID,
}: {
  readonly model: ChoiceGroupModel;
  readonly onChange: (id: string | undefined) => void;
  readonly testID?: string | undefined;
}) {
  const k = useStyles(kitStyles),
    s = useStyles(styles);
  return (
    <View style={k.stack}>
      <View style={s.spread}>
        <Text role="label">{model.label}</Text>
        {/* The reset belongs to the choice, not to the column of actions below it: a
            control that takes its own full-width row among the verbs a person is
            choosing between reads as one of them. */}
        {model.canClear ? (
          <Button label={model.clearLabel} tone="plain" onPress={() => onChange(undefined)} />
        ) : null}
      </View>
      <View style={k.row} accessibilityRole="radiogroup" accessibilityLabel={model.label}>
        {model.choices.map((choice) => (
          <Button
            key={choice.id}
            label={choice.label}
            tone={choice.selected ? "primary" : "secondary"}
            accessibilityRole="radio"
            checked={choice.selected}
            disabled={!choice.enabled}
            {...(choice.reason ? { reason: choice.reason } : {})}
            {...(testID ? { testID: `${testID}/${encodeURIComponent(choice.id)}` } : {})}
            onPress={() => {
              if (choice.change) onChange(choice.id);
            }}
          />
        ))}
      </View>
      {model.issue ? <Notice text={model.issue.message} announcement="polite" /> : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    // The choice's name and its reset share one line. The kit's `row` wraps and packs
    // its children from the left, which is right for the chips themselves; a name
    // with a word about the choice beside it puts that word at the edge of the space
    // the choice is drawn in, where a person looks for it after reading the name.
    spread: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.space.sm,
    },
  });
