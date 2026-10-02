import React from "react";
import { View } from "react-native";
import type { BarModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { ChoiceChips } from "../molecules/ChoiceChips";
import { ModelState } from "../molecules/ModelState";
import { kitStyles } from "../layout";
import { useStyles, useTheme } from "../theme";
export function BarChart({
  model,
  onCategory,
  onRange,
  onRetry,
}: {
  readonly model: BarModel;
  readonly onCategory: (id: string) => void;
  readonly onRange: (id: string) => void;
  readonly onRetry: () => void;
}) {
  const s = useStyles(kitStyles),
    t = useTheme();
  return (
    <View style={s.stack}>
      <ModelState model={model} onRetry={onRetry} />
      {model.ranges.choices.length ? (
        <ChoiceChips
          model={model.ranges}
          onChange={(id) => {
            if (id) onRange(id);
          }}
        />
      ) : null}
      {model.empty ? <Text>{model.emptyLabel}</Text> : null}
      <Text>{model.axesLabel}</Text>
      <View style={s.row}>
        {model.categories.map((category) => (
          <View key={category.id} style={s.grow}>
            <View style={[s.row, { height: t.extent.chart }]} accessible={false}>
              {category.values.map((value) => (
                <View key={value.seriesId} style={{ flex: 1, height: "100%" }}>
                  <View
                    style={{
                      position: "absolute",
                      top: `${value.top * 100}%`,
                      height: `${value.height * 100}%`,
                      width: "100%",
                      backgroundColor: t.color.textPrimary,
                    }}
                  />
                </View>
              ))}
            </View>
            <Button
              label={category.label}
              tone="secondary"
              selected={category.selected}
              onPress={() => {
                if (!category.selected) onCategory(category.id);
              }}
            />
          </View>
        ))}
      </View>
      <Text role="title">{model.tableLabel}</Text>
      {model.categories.map((category) => (
        <View key={category.id}>
          {category.values.map((value) => (
            <Text key={value.seriesId}>{value.accessibleLabel}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}
