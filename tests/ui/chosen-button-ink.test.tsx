import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import { contrastRatio } from "../../src/core/color";
import { Button } from "../../src/ui/atoms/Button";
import { ThemeProvider } from "../../src/ui/theme";
import { VerbStage } from "../../src/ui/verb";

// Measure the actual label and surface together: the same chosen state may be
// filled on the main screen and outlined when composed as a companion.
for (const mode of ["light", "dark"] as const) {
  for (const lead of [true, false]) {
    for (const spelling of ["selected", "checked"] as const) {
      test(`${mode}, lead=${lead}, ${spelling}: chosen button ink reads on its rendered surface`, async () => {
        const tones = ["primary", "destructive", "secondary", "plain"] as const;
        await render(
          <ThemeProvider mode={mode}>
            <VerbStage lead={lead}>
              {tones.map((tone) => (
                <Button
                  key={tone}
                  label={tone}
                  tone={tone}
                  testID={tone}
                  accessibilityRole={spelling === "checked" ? "checkbox" : "button"}
                  {...{ [spelling]: true }}
                  onPress={() => {}}
                />
              ))}
            </VerbStage>
          </ThemeProvider>,
        );
        for (const tone of tones) {
          const background = StyleSheet.flatten(
            screen.getByTestId(tone).props.style,
          ).backgroundColor;
          const foreground = StyleSheet.flatten(screen.getByText(tone).props.style).color;
          expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }
}
