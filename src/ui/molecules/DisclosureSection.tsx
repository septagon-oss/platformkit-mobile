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
  summaryInside = false,
}: {
  readonly model: DisclosureModel;
  readonly children: React.ReactNode;
  readonly onExpanded: (value: boolean) => void;
  readonly testID?: string;
  /**
   * summaryInside keeps the sentence that explains what a section holds *with*
   * what it holds. A section that stands as one row of a screen — a gallery
   * page's other states — has already said what it is by its name; the sentence
   * is for whoever opens it, and printed above the control it pushed the screen
   * itself down the fold.
   */
  readonly summaryInside?: boolean;
}) {
  const s = useStyles(kitStyles);
  return (
    <View style={s.stack}>
      <Text role="title" accessibilityRole="header">
        {model.title}
      </Text>
      {summaryInside ? null : <Text>{model.summary}</Text>}
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
      {model.expanded ? (
        <>
          {summaryInside ? <Text>{model.summary}</Text> : null}
          {children}
        </>
      ) : null}
    </View>
  );
}
