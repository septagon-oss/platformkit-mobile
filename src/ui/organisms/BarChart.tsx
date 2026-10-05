import React from "react";
import { View } from "react-native";
import type { BarModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { ChoiceChips } from "../molecules/ChoiceChips";
import { ModelState } from "../molecules/ModelState";
import { kitStyles } from "../layout";
import { statusInk, useStyles, useTheme } from "../theme";

/**
 * Bars are measured from nothing, so the plot owes two things a column of
 * floating rectangles does not: the line every column stands on, and a scale a
 * reader can look a value up against. Both come from the model, which is the
 * only place that knows the domain.
 */
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
      <View style={s.chartPlot}>
        <View style={s.chartAxis} testID="kit-chart-axis">
          {model.yTicks.map((tick) => (
            <Text
              key={tick.position}
              role="caption"
              tone="muted"
              style={[s.chartTick, { top: `${tick.position * 100}%` }]}
            >
              {tick.label}
            </Text>
          ))}
        </View>
        <View style={s.grow}>
          <View style={s.chart}>
            <View style={s.chartColumn} accessible={false}>
              {model.categories.map((category) => (
                <View key={category.id} style={s.grow}>
                  {category.values.map((value) => (
                    <View key={value.seriesId} style={{ flex: 1, height: "100%" }}>
                      <View
                        testID={`kit-bar:${value.seriesId}:${category.id}`}
                        style={{
                          position: "absolute",
                          top: `${value.top * 100}%`,
                          height: `${value.height * 100}%`,
                          width: "100%",
                          backgroundColor: statusInk(t, value.tone),
                        }}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </View>
            {model.zero === undefined ? null : (
              <View
                testID="kit-chart-zero"
                style={[s.chartBaseline, { top: `${model.zero * 100}%` }]}
              />
            )}
          </View>
          <View style={s.chartLabels}>
            {model.categories.map((category) => (
              <View key={category.id} style={s.chartLabel}>
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
        </View>
      </View>
      {/* One caption names what the lines below are, exactly once, and each
          observation is then written once beside it — the same shape the area
          chart's text alternative takes. */}
      <View style={s.chartValues} testID="kit-chart-values">
        <Text role="caption" tone="muted">
          {`${model.tableLabel} · ${model.axesLabel}`}
        </Text>
        {model.categories.map((category) => (
          <View key={category.id}>
            {category.values.map((value) => (
              <Text key={value.seriesId}>{value.accessibleLabel}</Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
