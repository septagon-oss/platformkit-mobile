import React from "react";
import { View } from "react-native";
import type { SlotPickerModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Notice } from "../atoms/Notice";
import { ModelState } from "../molecules/ModelState";
import { SlotOption } from "../molecules/SlotOption";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export function SlotPicker({
  model,
  onDate,
  onSelect,
  onClear,
  onRefresh,
}: {
  readonly model: SlotPickerModel;
  readonly onDate: (date: string) => void;
  readonly onSelect: (selection: {
    readonly slotId: string;
    readonly availabilityVersion: string;
    readonly quantity: number;
  }) => void;
  readonly onClear: () => void;
  readonly onRefresh: () => void;
}) {
  const s = useStyles(kitStyles);
  return (
    <View style={s.stack}>
      <View style={s.row}>
        {model.dates.map((date) => (
          <Button
            key={date.id}
            label={date.label}
            tone={date.selected ? "primary" : "secondary"}
            selected={date.selected}
            onPress={() => {
              if (!date.selected) onDate(date.id);
            }}
          />
        ))}
      </View>
      <ModelState model={model} onRetry={onRefresh} />
      {model.slots.map((slot) => (
        <SlotOption
          key={slot.id}
          model={slot}
          onSelect={(id) => {
            const selected = model.slots.find((s) => s.id === id);
            if (selected?.enabled && !selected.selected) onSelect(selected.target);
          }}
        />
      ))}
      {model.selectionIssue ? (
        <Notice text={model.selectionIssue.message} announcement="polite" />
      ) : null}
      {model.expired ? <Notice text={model.expired} announcement="polite" /> : null}
      {model.canClear ? <Button label={model.clearLabel} tone="plain" onPress={onClear} /> : null}
      <Button label={model.refreshLabel} tone="plain" onPress={onRefresh} />
    </View>
  );
}
