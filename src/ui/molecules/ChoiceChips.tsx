import React from "react";
import { View } from "react-native";
import type { ChoiceGroupModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Notice } from "../atoms/Notice";
import { Text } from "../atoms/Text";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export function ChoiceChips({
  model,
  onChange,
  testID,
}: {
  readonly model: ChoiceGroupModel;
  readonly onChange: (id: string | undefined) => void;
  readonly testID?: string | undefined;
}) {
  const s = useStyles(kitStyles);
  return (
    <View style={s.stack}>
      <Text role="label">{model.label}</Text>
      <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel={model.label}>
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
      {model.canClear ? (
        <Button label={model.clearLabel} tone="plain" onPress={() => onChange(undefined)} />
      ) : null}
      {model.issue ? <Notice text={model.issue.message} announcement="polite" /> : null}
    </View>
  );
}
