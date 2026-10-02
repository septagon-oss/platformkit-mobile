import React from "react";
import { View } from "react-native";
import type { CalendarModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Notice } from "../atoms/Notice";
import { DayStrip } from "../molecules/DayStrip";
import { AgendaList } from "./AgendaList";
import { WeekCalendar, type Props as WeekProps } from "./WeekCalendar";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export function Calendar({
  model,
  onDate,
  onEvent,
  onMoreEvents,
  onRefresh,
  onMore,
  onView,
  onNavigate,
}: Omit<WeekProps, "model"> & {
  readonly model: CalendarModel;
  readonly onRefresh: () => void;
  readonly onMore: () => void;
  readonly onView: (view: CalendarModel["view"]) => void;
  readonly onNavigate: (range: {
    readonly startDate: string;
    readonly endDate: string;
    readonly selectedDate: string;
  }) => void;
}) {
  const s = useStyles(kitStyles);
  const navigate = (key: keyof CalendarModel["navigation"]) => {
    const target = model.strip.navigation[key];
    if (target.enabled) onNavigate(target.target);
  };
  return (
    <View style={s.grow}>
      <View style={s.row}>
        {model.views.map((view) => (
          <Button
            key={view.id}
            label={view.label}
            tone="secondary"
            selected={view.selected}
            onPress={() => {
              if (!view.selected) onView(view.id);
            }}
          />
        ))}
      </View>
      <DayStrip
        model={model.strip}
        onDate={onDate}
        onPrevious={() => navigate("previous")}
        onNext={() => navigate("next")}
        onToday={() => navigate("today")}
      />
      {model.selectionIssue ? (
        <Notice text={model.selectionIssue.message} announcement="polite" />
      ) : null}
      {model.view === "agenda" ? (
        <AgendaList model={model.agenda} onEvent={onEvent} onRefresh={onRefresh} onMore={onMore} />
      ) : (
        <WeekCalendar model={model} onDate={onDate} onEvent={onEvent} onMoreEvents={onMoreEvents} />
      )}
    </View>
  );
}
