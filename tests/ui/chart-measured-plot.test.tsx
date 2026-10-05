// A bar chart says how much, measured against what. Two drawings make that a
// readable claim rather than a shape: the line every column stands on, and the
// numbers a reader looks a column up against. One ink per tone says which series
// a column belongs to. All three come from the model, which owns the domain.
import { presentation } from "../fakes/presentation";
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import {
  deriveBars,
  deriveChart,
  type BarInput,
  type BarModel,
  type ChartModel,
} from "../../src/core/derive";
import { AreaChart } from "../../src/ui/organisms/AreaChart";
import { BarChart } from "../../src/ui/organisms/BarChart";
import { ThemeProvider, themeFor } from "../../src/ui/theme";

const none = () => undefined;
const categories = [
  { id: "print", label: "Print room" },
  { id: "courtyard", label: "Courtyard" },
];

function bars(values: Record<string, number>): BarModel {
  const input: BarInput = {
    content: {
      phase: "ready",
      refresh: "idle",
      value: {
        categories,
        series: [
          { id: "visitors", label: "Visitors", tone: "info", values },
          { id: "staff", label: "Staff", tone: "warning", values },
        ],
      },
    },
    xLabel: "Room",
    yLabel: "People",
    unitLabel: "people",
    fractionDigits: 0,
    ranges: [],
  };
  const result = deriveBars(input, presentation);
  if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}/${i.code}`).join(", "));
  return result.value;
}

function series(y: readonly [number, number]): ChartModel {
  const result = deriveChart(
    {
      content: {
        phase: "ready",
        refresh: "idle",
        value: [
          {
            id: "visitors",
            label: "Visitors",
            tone: "info",
            points: [
              { id: "a", x: 9, y: y[0] },
              { id: "b", x: 10, y: y[1] },
            ],
          },
        ],
      },
      xKind: "number",
      xLabel: "Hour",
      yLabel: "People",
      unitLabel: "people",
      fractionDigits: 0,
      domain: { x: [9, 10], y },
      ranges: [],
    },
    presentation,
  );
  if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}/${i.code}`).join(", "));
  return result.value;
}

const inLight = (element: React.ReactElement) =>
  render(<ThemeProvider mode="light">{element}</ThemeProvider>);

describe("a bar chart is measured", () => {
  test("the plot draws the zero its columns are measured from, where the model puts it", async () => {
    const model = bars({ print: -2, courtyard: 5 });
    await inLight(<BarChart model={model} onCategory={none} onRange={none} onRetry={none} />);
    const rule = StyleSheet.flatten(screen.getByTestId("kit-chart-zero").props.style) ?? {};
    expect(rule.top).toBe(`${model.zero! * 100}%`);
    const at = Number.parseFloat(String(rule.top));
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(100);
  });

  test("the axis names every value the plot is scaled against", async () => {
    const model = bars({ print: -2, courtyard: 5 });
    expect(model.yTicks.length).toBeGreaterThan(1);
    await inLight(<BarChart model={model} onCategory={none} onRange={none} onRetry={none} />);
    const axis = within(screen.getByTestId("kit-chart-axis"));
    for (const tick of model.yTicks) expect(axis.getByText(tick.label)).toBeOnTheScreen();
  });

  test("a column is drawn in the ink of the tone its series carries", async () => {
    const t = themeFor("light");
    await inLight(
      <BarChart
        model={bars({ print: -2, courtyard: 5 })}
        onCategory={none}
        onRange={none}
        onRetry={none}
      />,
    );
    const ink = (seriesId: string) =>
      StyleSheet.flatten(screen.getByTestId(`kit-bar:${seriesId}:courtyard`).props.style) ?? {};
    expect(ink("visitors").backgroundColor).toBe(t.color.statusInfo);
    expect(ink("staff").backgroundColor).toBe(t.color.statusWarning);
    expect(ink("visitors").backgroundColor).not.toBe(ink("staff").backgroundColor);
  });

  test("a category label sits under its own column and still selects it", async () => {
    const onCategory = jest.fn();
    await inLight(
      <BarChart
        model={bars({ print: -2, courtyard: 5 })}
        onCategory={onCategory}
        onRange={none}
        onRetry={none}
      />,
    );
    fireEvent.press(screen.getByRole("button", { name: "Courtyard" }));
    expect(onCategory).toHaveBeenCalledWith("courtyard");
  });
});

describe("a plot names zero only where its scale holds it", () => {
  test("a plot with nothing measured yet draws no zero line and no scale", async () => {
    const result = deriveBars(
      {
        content: { phase: "loading" },
        xLabel: "Room",
        yLabel: "People",
        unitLabel: "people",
        fractionDigits: 0,
        ranges: [],
      },
      presentation,
    );
    if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}/${i.code}`).join(", "));
    const model = result.value;
    expect(model.zero).toBeUndefined();
    expect(model.yTicks).toEqual([]);
    await inLight(<BarChart model={model} onCategory={none} onRange={none} onRetry={none} />);
    expect(screen.queryByTestId("kit-chart-zero")).toBeNull();
    expect(within(screen.getByTestId("kit-chart-axis")).queryByText(/people/)).toBeNull();
  });

  test("a chart that crosses zero draws the line at the zero the scale holds", async () => {
    const model = series([-5, 20]);
    expect(model.zero).toBeDefined();
    await inLight(
      <AreaChart model={model} onRange={none} onPoint={none} onClearPoint={none} onRetry={none} />,
    );
    const rule = StyleSheet.flatten(screen.getByTestId("kit-chart-zero").props.style) ?? {};
    expect(rule.top).toBe(`${model.zero! * 100}%`);
  });
});

/**
 * The x axis names a measurement where the plot drew it. A row of equal cells
 * puts every hour name a little inward of its own point, so the picture and its
 * labels make two claims at once; each name is set at the position the scale put
 * its measurement, and centred there rather than beginning there.
 */
describe("an x axis names its measurements where it drew them", () => {
  const hours = (): ChartModel => {
    const result = deriveChart(
      {
        content: {
          phase: "ready",
          refresh: "idle",
          value: [
            {
              id: "visitors",
              label: "Visitors",
              tone: "info",
              points: [
                { id: "a", x: 10, y: 4 },
                { id: "b", x: 12, y: 8 },
                { id: "c", x: 14, y: 6 },
              ],
            },
          ],
        },
        xKind: "number",
        xLabel: "Hour",
        yLabel: "People",
        unitLabel: "people",
        fractionDigits: 0,
        ranges: [],
      },
      presentation,
    );
    if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}/${i.code}`).join(", "));
    return result.value;
  };

  test("every tick name is centred on the position the scale puts its measurement", async () => {
    const model = hours();
    expect(model.xTicks.length).toBeGreaterThan(2);
    await inLight(
      <AreaChart model={model} onRange={none} onPoint={none} onClearPoint={none} onRetry={none} />,
    );
    for (const tick of model.xTicks) {
      const style = StyleSheet.flatten(screen.getByText(tick.label).props.style) ?? ({} as object);
      expect(style).toMatchObject({
        left: `${tick.position * 100}%`,
        transform: [{ translateX: "-50%" }],
      });
    }
  });
});
