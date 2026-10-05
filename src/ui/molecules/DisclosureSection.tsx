import React from "react";
import { View } from "react-native";
import type { DisclosureModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export function DisclosureSection({
  model,
  children,
  onExpanded,
  testID,
}: {
  readonly model: DisclosureModel;
  readonly children: React.ReactNode;
  readonly onExpanded: (value: boolean) => void;
  readonly testID?: string;
}) {
  const s = useStyles(kitStyles);
  return (
    <View style={s.stack}>
      <Text role="title" accessibilityRole="header">
        {model.title}
      </Text>
      <Text>{model.summary}</Text>
      <Button
        label={model.control.label}
        tone="plain"
        expanded={model.expanded}
        {...(testID ? { testID } : {})}
        disabled={!model.control.enabled}
        {...(model.reason ? { reason: model.reason } : {})}
        onPress={() => {
          if (model.control.enabled) onExpanded(model.target);
        }}
      />
      {model.expanded ? children : null}
    </View>
  );
}
