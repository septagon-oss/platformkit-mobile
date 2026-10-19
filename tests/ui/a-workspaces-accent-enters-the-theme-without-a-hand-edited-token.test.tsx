// A workspace's accent arrives as a value, never as a token: the generated palette stays
// the only writer of colour in the repository, and `accentPalette` copies it and wears the
// workspace's colour in its accent roles. This suite pins that the copy is a copy, that the
// palette on disk is never touched, and that an accent the theme cannot keep legible keeps
// the kit's own colours by identity — so a refused accent cannot even ask for a re-render.
import { describe, expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Button } from "../../src/ui/atoms/Button";
import { accentPalette, ThemeProvider } from "../../src/ui/theme";
import { palette } from "../../src/ui/tokens";

describe("a workspace's accent enters the theme", () => {
  test("as the nearest legible shade of itself, in both modes, over an untouched palette", () => {
    const worn = accentPalette(palette, "#2563eb");
    expect(worn.light.accentDefault).toBe("#2461e6");
    expect(worn.dark.accentDefault).toBe("#97a9eb");
    // The ink written on the accent is the export's own, in both modes.
    expect(worn.light.accentOn).toBe(palette.light.accentOn);
    expect(worn.dark.accentOn).toBe(palette.dark.accentOn);
    // A hover is still the accent's own darker shade, and everything else is unchanged.
    expect(worn.light.accentHover).not.toBe(worn.light.accentDefault);
    expect(worn.light.statusInfo).toBe(palette.light.statusInfo);
    expect(worn.light.surfaceCanvas).toBe(palette.light.surfaceCanvas);
    // The generated pair is a copy, not a canvas: nothing writes into it.
    expect(palette.light.accentDefault).toBe("#0f5d4e");
    expect(palette.dark.accentDefault).toBe("#4bbf9c");
    expect(Object.isFrozen(worn)).toBe(true);
  });

  test("and reaches a shared component in both modes through the provider that already takes a palette", async () => {
    const worn = accentPalette(palette, "#2563eb");
    const view = (mode: "light" | "dark") => (
      <ThemeProvider mode={mode} palette={worn}>
        <Button label="Save" onPress={() => undefined} testID="save" />
      </ThemeProvider>
    );
    await render(view("light"));
    expect(screen.getByRole("button", { name: "Save" })).toHaveStyle({
      backgroundColor: "#2461e6",
    });
    await screen.rerender(view("dark"));
    expect(screen.getByRole("button", { name: "Save" })).toHaveStyle({
      backgroundColor: "#97a9eb",
    });
  });
});

describe("an accent the theme cannot keep legible", () => {
  for (const accent of [
    "#ffd400",
    "#c2c23a",
    "#4bbf9c",
    "#ffffff",
    "rgb(1,2,3)",
    "#fff",
    "#GGGGGG",
  ]) {
    test(`${accent} keeps the kit's own colours, answered by identity`, () => {
      expect(accentPalette(palette, accent)).toBe(palette);
    });
  }

  test("and so does no accent at all, which is what a workspace with nothing to say answers", () => {
    expect(accentPalette(palette, undefined)).toBe(palette);
    expect(accentPalette(palette, "")).toBe(palette);
  });
});
