import React from "react";
import { View } from "react-native";
import type { ActionBarModel } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
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
    <View style={s.row} accessibilityLabel={model.label}>
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
