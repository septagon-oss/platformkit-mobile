import React from "react";
import { View } from "react-native";
import type { AgendaModel } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { ModelState } from "../molecules/ModelState";
import { GroupedListScreen } from "../templates/ListScreen";
export function AgendaList({
  model,
  onEvent,
  onRefresh,
  onMore,
}: {
  readonly model: AgendaModel;
  readonly onEvent: (id: string) => void;
  readonly onRefresh?: () => void;
  readonly onMore?: () => void;
}) {
  return (
    <GroupedListScreen
      sections={model.days.map((day) => ({ id: day.id, data: day.events }))}
      keyOf={(e) => e.id}
      refreshing={model.refreshing}
      {...(onRefresh ? { onRefresh } : {})}
      renderHeading={(id) => {
        const day = model.days.find((d) => d.id === id)!;
        return (
          <View>
            <Text role="title" accessibilityRole="header">
              {day.title}
            </Text>
            {!day.events.length ? <Text>{day.emptyLabel}</Text> : null}
          </View>
        );
      }}
      render={(event) => (
        <Button
          label={event.label}
          tone="secondary"
          disabled={!event.enabled}
          selected={event.selected}
          onPress={() => {
            if (event.enabled) onEvent(event.id);
          }}
        />
      )}
      header={<ModelState model={model} {...(onRefresh ? { onRetry: onRefresh } : {})} />}
      footer={model.more && onMore ? <ActionControl model={model.more} onAction={onMore} /> : null}
    />
  );
}
