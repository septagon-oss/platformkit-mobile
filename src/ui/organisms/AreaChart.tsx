import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { ChartModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { ChoiceChips } from "../molecules/ChoiceChips";
import { ModelState } from "../molecules/ModelState";
import { kitStyles } from "../layout";
import { statusInk, useStyles, useTheme } from "../theme";

/**
 * The plot is drawn inside a margin of its own box so a measurement on the edge
 * keeps its whole mark — a point at x=0 is a full circle, not a clipped half.
 * The x axis is set in that same band: a label is written where the measurement
 * it names was drawn, not in the middle of an equal share of the width.
 */
const plotMargin = 0.03,
  plotBox = `${-plotMargin} ${-plotMargin} ${1 + plotMargin * 2} ${1 + plotMargin * 2}`,
  // The fraction of the plot's width between its edge and where x=0 is drawn.
  plotInset = plotMargin / (1 + plotMargin * 2);

/**
 * A label may be as wide as the narrowest gap between two ticks, which is what
 * keeps two names from running into each other while each stays centred on its
 * own measurement. It is a ceiling and not a floor: a tick named by two figures
 * takes a two-figure box, so the box of the last name on the axis ends with that
 * name instead of reaching past the plot's edge into the column beside it.
 */
const tickSpan = (positions: readonly number[]): number =>
  positions.length < 2 ? 1 : Math.min(...positions.slice(1).map((at, i) => at - positions[i]!));

export function AreaChart({
  model,
  onRange,
  onPoint,
  onClearPoint,
  onRetry,
}: {
  readonly model: ChartModel;
  readonly onRange: (id: string) => void;
  readonly onPoint: (point: { readonly seriesId: string; readonly pointId: string }) => void;
  readonly onClearPoint: () => void;
  readonly onRetry: () => void;
}) {
  const s = useStyles(kitStyles),
    t = useTheme();
  // Each series is drawn in the ink of the tone its model carries, so the mark
  // and the word that names it agree; a second series of the same tone is told
  // apart by its dash, which the plot below keeps by position.
  const colors = model.series.map((series) => statusInk(t, series.tone));
  const span = tickSpan(model.xTicks.map((tick) => tick.position));
  return (
    <View style={s.stack}>
      <ModelState model={model} onRetry={onRetry} />
      {/* The plot's one observation leads the specimen: what a person came to read is
          named before the range, the axis, the key and the values that support it, so
          a chart at a phone's width opens with a sentence rather than a shape. */}
      {model.takeaway ? (
        <Text role="title" accessibilityRole="header" testID="kit-chart-takeaway">
          {model.takeaway}
        </Text>
      ) : null}
      {model.ranges.choices.length ? (
        <ChoiceChips
          model={model.ranges}
          onChange={(id) => {
            if (id) onRange(id);
          }}
        />
      ) : null}
      {model.empty ? (
        <Text>{model.emptyLabel}</Text>
      ) : (
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
              <View style={s.grow} accessibilityElementsHidden>
                <Svg width="100%" height="100%" viewBox={plotBox} preserveAspectRatio="none">
                  {model.series.map((series, i) => (
                    <React.Fragment key={series.id}>
                      {series.fill ? (
                        <Path d={series.fill} fill={colors[i]!} opacity={0.12} />
                      ) : null}
                      {series.path ? (
                        <Path
                          d={series.path}
                          fill="none"
                          stroke={colors[i]!}
                          strokeWidth={t.extent.chartStroke}
                          {...(i
                            ? { strokeDasharray: `${t.extent.chartDot * i} ${t.extent.chartDot}` }
                            : {})}
                        />
                      ) : null}
                      {series.points
                        .filter((point) => point.py !== undefined)
                        .map((point) => (
                          <Circle
                            key={point.id}
                            cx={point.px}
                            cy={point.py!}
                            r={t.extent.chartDot}
                            fill={colors[i]!}
                          />
                        ))}
                    </React.Fragment>
                  ))}
                </Svg>
              </View>
              {model.zero === undefined ? null : (
                <View
                  testID="kit-chart-zero"
                  style={[s.chartBaseline, { top: `${model.zero * 100}%` }]}
                />
              )}
            </View>
            <View style={s.chartTicks}>
              <View
                style={[
                  s.chartTickBand,
                  { left: `${plotInset * 100}%`, right: `${plotInset * 100}%` },
                ]}
              >
                {model.xTicks.map((tick) => (
                  <Text
                    key={tick.position}
                    role="caption"
                    tone="muted"
                    style={[
                      s.chartTickLabel,
                      { left: `${tick.position * 100}%`, maxWidth: `${span * 100}%` },
                    ]}
                  >
                    {tick.label}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>
      )}
      {/* The key belongs with the plot: two series drawn in two inks are only two
          series once the page says which ink is which. */}
      <View style={s.legend} testID="kit-chart-legend">
        {model.series.map((series, i) => (
          <View key={`legend-${series.id}`} style={s.legendItem}>
            <View style={[s.legendMark, { backgroundColor: colors[i]! }]} />
            <Text role="label">{series.label}</Text>
          </View>
        ))}
      </View>
      {/* The exact values are the plot's text alternative: one line per observation,
          each naming its series, its hour and its figure, in the order drawn. A line
          that opens that observation is a control; a line that only repeats a figure
          under a heading that already names it is not, which is what turned this
          table into a wall of outlined boxes. */}
      <View style={s.chartValues} testID="kit-chart-values">
        <Text role="caption" tone="muted">
          {`${model.tableLabel} · ${model.axesLabel}`}
        </Text>
        {model.series.map((series) => (
          <View key={series.id}>
            {series.points.map((point) =>
              point.y === null ? (
                <Text key={point.id} accessibilityLabel={point.accessibleLabel}>
                  {point.displayLabel}
                </Text>
              ) : (
                <Button
                  key={point.id}
                  label={point.accessibleLabel}
                  tone="plain"
                  selected={point.selected}
                  onPress={() => {
                    if (!point.selected) onPoint({ seriesId: series.id, pointId: point.id });
                  }}
                />
              ),
            )}
          </View>
        ))}
      </View>
      {/* Returning a choice is offered while a choice is held. A screen that
          prints "Clear" beside a plot with nothing selected asks for an act
          that would change nothing. */}
      {model.clearsSelection ? (
        <Button label={model.clearLabel} tone="plain" onPress={onClearPoint} />
      ) : null}
    </View>
  );
}
