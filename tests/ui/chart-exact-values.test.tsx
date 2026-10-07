// A chart that only exposes its numbers makes the reader do the reading. The plot
// says the one thing it was drawn for — its largest observation — and the exact
// values then sit under one caption as the plot's text alternative: a line per
// observation, naming its series once, and only the lines that open an
// observation are offered as controls.
import React from "react";
import { expect, test } from "@jest/globals";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { deriveChart, kitExamples, type ChartModel, type Result } from "../../src/core/derive";
import { AreaChart } from "../../src/ui/organisms/AreaChart";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const ok = <T,>(result: Result<T>): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

const draw = async (model: ChartModel, onPoint: (value: unknown) => void = () => {}) =>
  await render(
    <ThemeProvider mode="light">
      <AreaChart
        model={model}
        onRange={() => {}}
        onPoint={onPoint}
        onClearPoint={() => {}}
        onRetry={() => {}}
      />
    </ThemeProvider>,
  );

const model = ok(kitExamples(presentation, "area-chart/multiple-series")).chart;
const values = () => within(screen.getByTestId("kit-chart-values"));

test("the plot names the observation it was drawn for before its values", async () => {
  await draw(model);
  const largest = model.series
    .flatMap((series) =>
      series.points.filter((point): point is typeof point & { y: number } => point.y !== null),
    )
    .reduce((best, point) => (point.y > best.y ? point : best));
  expect(screen.getByTestId("kit-chart-values")).toBeTruthy();
  expect(screen.queryAllByText(model.takeaway!)).toHaveLength(1);
  expect(model.takeaway).toContain(presentation.copy.kit.peak);
  expect(model.takeaway).toContain(largest.text);
  expect(model.takeaway).toContain(largest.xText);
});

test("a plot with no measurement claims no peak", () => {
  const empty = ok(
    deriveChart(
      {
        content: {
          phase: "ready",
          refresh: "idle",
          value: [
            { id: "s", label: "Visitors", tone: "neutral", points: [{ id: "p", x: 1, y: null }] },
          ],
        },
        xKind: "number",
        xLabel: "Hour",
        yLabel: "Visitors",
        unitLabel: "visitors",
        fractionDigits: 0,
        ranges: [],
      },
      presentation,
    ),
  );
  expect(empty.empty).toBe(true);
  expect(empty.takeaway).toBeUndefined();
});

test("exact values read as one table, each observation named once", async () => {
  await draw(model);
  // One caption names the table and its axes together; neither stands alone as a
  // heading again above the lines.
  expect(screen.queryAllByText(model.tableLabel)).toHaveLength(0);
  expect(screen.queryAllByText(model.axesLabel)).toHaveLength(0);
  expect(values().getByText(`${model.tableLabel} · ${model.axesLabel}`)).toBeTruthy();
  const observations = model.series.flatMap((series) =>
    series.points.map((point) => ({ series, point })),
  );
  for (const { point } of observations)
    expect(
      within(screen.getByTestId("kit-chart-values")).queryAllByText(point.accessibleLabel),
    ).toHaveLength(1);
  // Only an observation a person can open is a control, and one press opens that one.
  const opened: unknown[] = [];
  await draw(model, (value) => opened.push(value));
  const openable = observations.filter(({ point }) => point.y !== null);
  await fireEvent.press(values().getByText(openable[0]!.point.accessibleLabel));
  expect(opened).toEqual([{ seriesId: openable[0]!.series.id, pointId: openable[0]!.point.id }]);
});
