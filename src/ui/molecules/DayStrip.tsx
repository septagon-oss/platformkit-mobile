import React from "react";
import { View } from "react-native";
import type { DayStripModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
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
  const s = useStyles(kitStyles);
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
      <View style={s.row}>
        {model.days.map((day) => (
          <Button
            key={day.id}
            label={day.today ? `${day.title} · ${day.todayLabel}` : day.title}
            tone={day.selected ? "primary" : "secondary"}
            selected={day.selected}
            disabled={!day.enabled}
            onPress={() => {
              if (day.enabled && !day.selected) onDate(day.id);
            }}
          />
        ))}
      </View>
    </View>
  );
}
