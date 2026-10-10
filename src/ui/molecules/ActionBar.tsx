import React from "react";
import { View } from "react-native";
import type { ActionBarModel } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
import { testable } from "../props";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export function ActionBar({
  model,
  onAction,
  testID,
}: {
  readonly model: ActionBarModel;
  readonly onAction?: (id: string) => void;
  readonly testID?: string | undefined;
}) {
  const s = useStyles(kitStyles);
  return (
    // The bar carries the id as well as handing it to every door inside it: a control
    // a person can read the name of is a control a journey may want to look up.
    <View style={s.row} accessibilityLabel={model.label} {...testable(testID)}>
      {model.actions.map((action) => (
        <ActionControl
          key={action.id}
          model={action}
          {...(onAction ? { onAction } : {})}
          testID={testID ? `${testID}/${encodeURIComponent(action.id)}` : undefined}
        />
      ))}
    </View>
  );
}
