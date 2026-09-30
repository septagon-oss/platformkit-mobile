import React from "react";
import { ScrollView, View } from "react-native";
import { calendarTargets, type WeekModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { Badge } from "../atoms/Badge";
import { ModelState } from "../molecules/ModelState";
import { kitStyles } from "../layout";
import { useStyles, useTheme } from "../theme";
export interface Props {
  readonly model: WeekModel;
  readonly onDate: (date: string) => void;
  readonly onEvent: (id: string) => void;
  readonly onMoreEvents: (group: {
    readonly date: string;
    readonly eventIds: readonly string[];
  }) => void;
}
export function WeekCalendar({ model, onDate, onEvent, onMoreEvents }: Props) {
  const s = useStyles(kitStyles),
    t = useTheme();
  return (
    <View style={s.stack}>
      <ModelState model={model} />
      <ScrollView horizontal>
        <View style={s.row}>
          {model.days.map((day) => (
            <View key={day.id} style={[s.column, s.panel]}>
              <Button
                label={day.title}
                tone="secondary"
                selected={day.selected}
                disabled={!day.enabled}
                onPress={() => {
                  if (day.enabled && !day.selected) onDate(day.id);
                }}
              />
              {day.events
                .filter((e) => e.kind === "all-day")
                .map((event) => (
                  <Button
                    key={event.id}
                    label={event.label}
                    tone="secondary"
                    disabled={!event.enabled}
                    onPress={() => {
                      if (event.enabled) onEvent(event.id);
                    }}
                  />
                ))}
              <View style={{ height: t.extent.calendarHeight }}>
                {day.ticks.map((tick) => (
                  <Text
                    key={tick.position}
                    role="caption"
                    tone="muted"
                    style={{ position: "absolute", top: `${tick.position * 100}%` }}
                  >
                    {tick.label}
                  </Text>
                ))}
                {calendarTargets(day, t.extent.calendarHeight, t.hit).map((group) =>
                  group.grouped ? (
                    <View
                      key={group.eventIds.join("/")}
                      style={{
                        position: "absolute",
                        top: `${group.events[0]!.top * 100}%`,
                        left: t.space.xl,
                        right: 0,
                      }}
                    >
                      <Button
                        label={group.label}
                        tone="secondary"
                        onPress={() => onMoreEvents({ date: group.date, eventIds: group.eventIds })}
                      />
                    </View>
                  ) : (
                    group.events.map((event) => (
                      <View
                        key={event.id}
                        style={{
                          position: "absolute",
                          top: `${event.top * 100}%`,
                          height: event.height * t.extent.calendarHeight,
                          left: `${(event.lane / event.lanes) * 100}%`,
                          width: `${100 / event.lanes}%`,
                        }}
                      >
                        <Button
                          label={event.label}
                          tone="secondary"
                          selected={event.selected}
                          disabled={!event.enabled}
                          onPress={() => {
                            if (event.enabled) onEvent(event.id);
                          }}
                        />
                        {event.status ? (
                          <Badge label={event.status.label} tone={event.status.tone} />
                        ) : null}
                      </View>
                    ))
                  ),
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
