// A meter is read, not adjusted. The kit's other progress surfaces (Stepper,
// Skeleton, Spinner) announce themselves as a progressbar; a meter announced
// as "adjustable" tells a screen-reader user to swipe a value that has no
// increment or decrement to answer the swipe.
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { deriveMeter } from "../../src/core/progress";
import { ProgressMeter } from "../../src/ui/molecules/ProgressMeter";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

test("a determinate meter is announced as a progressbar with its value", async () => {
  const result = deriveMeter({ value: 5, max: 12, label: "Backups" }, presentation);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  await render(
    <ThemeProvider mode="light">
      <ProgressMeter model={result.value} testID="meter" />
    </ThemeProvider>,
  );
  const meter = screen.getByTestId("meter");
  expect(meter).toHaveProp("accessibilityRole", "progressbar");
  expect(meter).toHaveProp("accessibilityValue", { min: 0, max: 12, now: 5, text: "5 of 12" });
});
