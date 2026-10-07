import React from "react";
import { ScrollView, View } from "react-native";
import type { DayStripModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { kitStyles } from "../layout";
import { useStyles, useTheme } from "../theme";

/**
 * A week is one line of days. Wrapped, seven named days become three unrelated
 * rows and the sequence a person scans — this day, then the next one — is gone;
 * sideways, the week keeps its order and the days past the edge are one push
 * away, which is what the kit's own grid says in words (calendar.ts, `sideways`).
 */
export function DayStrip({
  model,
  onDate,
  onPrevious,
  onNext,
  onToday,
}: {
  readonly model: DayStripModel;
  readonly onDate: (date: string) => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onToday: () => void;
}) {
  const s = useStyles(kitStyles),
    t = useTheme();
  return (
    <View style={s.stack}>
      <View style={s.row}>
        <Button
          label={model.navigation.previous.label}
          tone="plain"
          disabled={!model.navigation.previous.enabled}
          onPress={onPrevious}
        />
        <Button
          label={model.navigation.today.label}
          tone="plain"
          disabled={!model.navigation.today.enabled}
          onPress={onToday}
        />
        <Button
          label={model.navigation.next.label}
          tone="plain"
          disabled={!model.navigation.next.enabled}
          onPress={onNext}
        />
      </View>
      <ScrollView
        horizontal
        contentContainerStyle={{
          flexDirection: "row",
          alignItems: "stretch",
          gap: t.space.sm,
        }}
      >
        {model.days.map((day) => (
          <Button
            key={day.id}
            label={day.label}
            name={day.title}
            tone={day.selected ? "primary" : "secondary"}
            selected={day.selected}
            disabled={!day.enabled}
            {...(day.today ? { current: day.todayLabel } : {})}
            onPress={() => {
              if (day.enabled && !day.selected) onDate(day.id);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}
