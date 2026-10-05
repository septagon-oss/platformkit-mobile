// Two series drawn in two inks are only two series once the screen says which ink
// is which: the plot's key stands beside the plot, one entry per series, and the
// value list below stays the text alternative rather than the explanation.
import React from "react";
import { expect, test } from "@jest/globals";
import { render, screen, within } from "@testing-library/react-native";
import { kitExamples, type Result } from "../../src/core/derive";
import { AreaChart } from "../../src/ui/organisms/AreaChart";
import { ThemeProvider, statusInk, themeFor } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const ok = <T,>(result: Result<T>): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

test("a chart with two series names the ink of each beside the plot", async () => {
  const model = ok(kitExamples(presentation, "area-chart/multiple-series")).chart;
  expect(model.series.length).toBeGreaterThan(1);
  await render(
    <ThemeProvider mode="light">
      <AreaChart
        model={model}
        onRange={() => {}}
        onPoint={() => {}}
        onClearPoint={() => {}}
        onRetry={() => {}}
      />
    </ThemeProvider>,
  );
  // One entry per series: its name, and a mark in the ink the plot draws it in.
  const drawn = JSON.stringify(screen.getByTestId("kit-chart-legend").toJSON());
  const t = themeFor("light");
  for (const series of model.series) {
    expect(within(screen.getByTestId("kit-chart-legend")).getAllByText(series.label)).toHaveLength(
      1,
    );
    expect(drawn).toContain(statusInk(t, series.tone));
  }
});
