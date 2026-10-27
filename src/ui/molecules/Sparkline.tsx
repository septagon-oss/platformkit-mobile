import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { SparklineModel } from "../../core/charts";
import { Text } from "../atoms/Text";
import { useTheme } from "../theme";
export interface Props {
  readonly model: SparklineModel;
  /**
   * height is the shape's side. The chart extent is a plot's, drawn under an axis a
   * card has no room for, so a caller that fits a shape into a smaller surface names
   * the extent it fits — a length from `scale.ts`, never a number written here.
   */
  readonly height?: number;
  /**
   * decorative says the shape carries no sentence of its own, because its caller says
   * the whole one: a series summary joins every point, so an unlabelled card would
   * otherwise read fourteen day-and-count pairs aloud before the number that matters.
   */
  readonly decorative?: boolean;
}
export function Sparkline({ model, height, decorative = false }: Props) {
  const t = useTheme();
  // The labelled View carries the meaning; the picture inside it is decoration.
  // It takes no accessibility prop of its own: react-native-svg hands every
  // unknown prop to the DOM node on web, where `accessible` is not an attribute,
  // and React answers a boolean there with a red overlay over the chart.
  return model.empty ? (
    <Text>{model.emptyLabel}</Text>
  ) : (
    <View
      {...(decorative
        ? {
            accessibilityElementsHidden: true,
            importantForAccessibility: "no-hide-descendants" as const,
          }
        : { accessible: true, accessibilityLabel: model.series.map((s) => s.summary).join(". ") })}
      style={{ height: height ?? t.extent.chart }}
    >
      <Svg width="100%" height="100%" viewBox="-0.03 -0.03 1.06 1.06" preserveAspectRatio="none">
        {model.series.map((series) => (
          <React.Fragment key={series.id}>
            {series.path ? (
              <Path
                d={series.path}
                stroke={t.color.textPrimary}
                strokeWidth={t.extent.chartStroke}
                fill="none"
              />
            ) : null}
            {series.points
              .filter((point) => point.py !== undefined)
              .map((point) => (
                <Circle
                  key={point.id}
                  cx={point.px}
                  cy={point.py}
                  r={t.extent.chartDot}
                  fill={t.color.textPrimary}
                />
              ))}
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}
