import React from "react";
import { ScrollView, View } from "react-native";
import { calendarTargets, type CalendarModel, type WeekModel } from "../../core/derive";
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
  /**
   * navigation is the week's own reach — the same three verbs a day strip is
   * given. Seven days do not fit a phone's column, so the grid is drawn sideways;
   * without the verbs beside it the row simply stops at the edge of the surface
   * and the days past that edge look lost rather than one scroll away.
   */
  readonly navigation?: CalendarModel["navigation"];
  readonly onNavigate?: (range: {
    readonly startDate: string;
    readonly endDate: string;
    readonly selectedDate: string;
  }) => void;
}
const steps: readonly (keyof CalendarModel["navigation"])[] = ["previous", "today", "next"];
export function WeekCalendar({
  model,
  navigation,
  onNavigate,
  onDate,
  onEvent,
  onMoreEvents,
}: Props) {
  const s = useStyles(kitStyles),
    t = useTheme();
  return (
    <ScrollView style={s.grow} contentContainerStyle={s.stack}>
      <ModelState model={model} />
      {navigation ? (
        <View style={s.row}>
          {steps.map((key) => (
            <Button
              key={key}
              label={navigation[key].label}
              tone="secondary"
              disabled={!navigation[key].enabled}
              onPress={() => {
                const step = navigation[key];
                if (step.enabled) onNavigate?.(step.target);
              }}
            />
          ))}
        </View>
      ) : null}
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
                {calendarTargets(
                  day,
                  t.extent.calendarHeight,
                  t.hit,
                  t.extent.calendarDay - 2 * t.space.lg,
                ).map((group) =>
                  group.grouped ? (
                    <View
                      key={group.eventIds.join("/")}
                      style={{
                        position: "absolute",
                        top: `${group.top * 100}%`,
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
                          <Badge
                            label={event.status.label}
                            tone={event.status.tone}
                            symbol={event.status.symbol}
                          />
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
      {model.sideways ? (
        <Text role="caption" tone="muted">
          {model.sideways}
        </Text>
      ) : null}
    </ScrollView>
  );
}
