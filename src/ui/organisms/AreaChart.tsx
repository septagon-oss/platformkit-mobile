import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { ChartModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { ChoiceChips } from "../molecules/ChoiceChips";
import { ModelState } from "../molecules/ModelState";
import { kitStyles } from "../layout";
import { useStyles, useTheme } from "../theme";
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
  const colors = [t.color.textPrimary, t.color.statusInfo, t.color.statusOk, t.color.statusWarning];
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
      {model.empty ? (
        <Text>{model.emptyLabel}</Text>
      ) : (
        <View style={s.chart} accessibilityElementsHidden>
          <Svg
            width="100%"
            height="100%"
            viewBox="-0.03 -0.03 1.06 1.06"
            preserveAspectRatio="none"
          >
            {model.series.map((series, i) => (
              <React.Fragment key={series.id}>
                {series.fill ? <Path d={series.fill} fill={colors[i]!} opacity={0.12} /> : null}
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
      )}
      <Text role="title">{model.tableLabel}</Text>
      <Text>
        {model.xLabel} · {model.yLabel}
      </Text>
      {model.series.map((series) => (
        <View key={series.id} style={s.stack}>
          <Text role="label">{series.label}</Text>
          {series.points.map((point) =>
            point.y === null ? (
              <Text key={point.id}>
                {point.xText}: {point.text}
              </Text>
            ) : (
              <Button
                key={point.id}
                label={`${series.label}, ${point.xText}: ${point.text}`}
                tone="secondary"
                selected={point.selected}
                onPress={() => {
                  if (!point.selected) onPoint({ seriesId: series.id, pointId: point.id });
                }}
              />
            ),
          )}
        </View>
      ))}
      <Button label={model.clearLabel} tone="plain" onPress={onClearPoint} />
    </View>
  );
}
