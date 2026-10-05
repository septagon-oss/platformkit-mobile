import React from "react";
import { View } from "react-native";
import type { AgendaModel } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
import { Text } from "../atoms/Text";
import { ModelState } from "../molecules/ModelState";
import { Row } from "../molecules/Row";
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
        // A week read top to bottom is mostly days with nothing in them. The date
        // is where the reader is, not an announcement, so it takes the edge label
        // and the one fact of an empty day is written in the same quiet ink.
        return (
          <View>
            <Text role="label" tone="muted" uppercase accessibilityRole="header">
              {day.title}
            </Text>
            {!day.events.length ? (
              <Text role="caption" tone="muted">
                {day.emptyLabel}
              </Text>
            ) : null}
          </View>
        );
      }}
      render={(event) => (
        // The appointment's name is the thing; when it is is a line of the record
        // under it. One long button label reading "Title · 09:00 – 09:45" made both
        // figures compete for one line of centred text.
        <Row
          title={event.title}
          cells={[event.time]}
          {...(event.enabled
            ? {
                onPress: () => {
                  onEvent(event.id);
                },
              }
            : {})}
        />
      )}
      header={<ModelState model={model} {...(onRefresh ? { onRetry: onRefresh } : {})} />}
      footer={model.more && onMore ? <ActionControl model={model.more} onAction={onMore} /> : null}
    />
  );
}
