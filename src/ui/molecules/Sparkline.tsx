import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { SparklineModel } from "../../core/derive";
import { Text } from "../atoms/Text";
import { useTheme } from "../theme";
export function Sparkline({ model }: { readonly model: SparklineModel }) {
  const t = useTheme();
  return model.empty ? (
    <Text>{model.emptyLabel}</Text>
  ) : (
    <View
      accessible
      accessibilityLabel={model.series.map((s) => s.summary).join(". ")}
      style={{ height: t.extent.chart }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="-0.03 -0.03 1.06 1.06"
        preserveAspectRatio="none"
        accessible={false}
      >
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
