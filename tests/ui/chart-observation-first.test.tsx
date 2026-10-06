// What a chart was drawn for is the first thing on it. A person arriving at a plot
// at a phone's width reads the one observation the series holds before the axis, the
// key and the values that support it — not a caption under the shape it describes.
import React from "react";
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { kitExamples, type Result } from "../../src/core/derive";
import { AreaChart } from "../../src/ui/organisms/AreaChart";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const ok = <T,>(result: Result<T>): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

const model = ok(kitExamples(presentation, "area-chart/multiple-series")).chart;

test("the plot's one observation is read before the plot itself", async () => {
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
  const drawn = JSON.stringify(screen.toJSON());
  const said = drawn.indexOf(JSON.stringify(model.takeaway));
  expect(said).toBeGreaterThanOrEqual(0);
  for (const part of ["kit-chart-axis", "kit-chart-legend", "kit-chart-values"]) {
    const at = drawn.indexOf(`"testID":"${part}"`);
    expect(at).toBeGreaterThan(-1);
    expect(said).toBeLessThan(at);
  }
});
