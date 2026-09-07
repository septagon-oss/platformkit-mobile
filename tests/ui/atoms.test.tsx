import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Button } from "../../src/ui/atoms/Button";
import { ChoiceRow } from "../../src/ui/atoms/ChoiceRow";
import { Notice } from "../../src/ui/atoms/Notice";
import { Text } from "../../src/ui/atoms/Text";
import { SwitchRow } from "../../src/ui/atoms/SwitchRow";
import { FormField } from "../../src/ui/molecules/FormField";
import { Row } from "../../src/ui/molecules/Row";
import { TagsField } from "../../src/ui/molecules/TagsField";
import { Section } from "../../src/ui/molecules/Section";
import { ThemeProvider } from "../../src/ui/theme";
import { palette } from "../../src/ui/tokens";

const inTheme = (el: React.ReactElement, mode: "light" | "dark" = "light") =>
  render(<ThemeProvider mode={mode}>{el}</ThemeProvider>);

describe("Button", () => {
  test("a busy button is a button that cannot be pressed and says so", async () => {
    const onPress = jest.fn();
    await inTheme(<Button label="Save" onPress={onPress} busy />);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  test("a primary button reads in the on-accent colour in both modes", async () => {
    await inTheme(<Button label="Go" onPress={() => undefined} />, "dark");
    expect(screen.getByText("Go")).toHaveStyle({ color: palette.dark.accentOn });
  });
});

describe("Notice", () => {
  test("a notice is an alert with its action", async () => {
    const retry = jest.fn();
    await inTheme(<Notice text="Unreachable." action={{ label: "Retry", onPress: retry }} />);
    expect(screen.getByRole("alert")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("FormField", () => {
  test("the refusal sits under the field it is about", async () => {
    await inTheme(
      <FormField label="Title" required error="is required">
        <></>
      </FormField>,
    );
    expect(screen.getByText("Title *")).toBeOnTheScreen();
    expect(screen.getByText("is required")).toBeOnTheScreen();
  });
});

describe("Rows", () => {
  test("a switch row is a switch whose whole row toggles", async () => {
    const onChange = jest.fn();
    await inTheme(<SwitchRow label="Pinned" value={false} onValueChange={onChange} />);
    await fireEvent.press(screen.getByRole("switch", { name: "Pinned" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test("a choice row announces what is chosen", async () => {
    await inTheme(
      <ChoiceRow
        label="Status"
        value="done"
        options={[
          { value: "open", label: "Open" },
          { value: "done", label: "Done" },
        ]}
        onChange={() => undefined}
      />,
    );
    // The test platform is iOS in jest-expo by default: a pressable row with the value.
    expect(screen.getByRole("button", { name: "Status" })).toHaveAccessibilityValue({
      text: "Done",
    });
  });

  test("a list row is announced with its cells and opens on press", async () => {
    const open = jest.fn();
    await inTheme(
      <Section title="Notes">
        <Row title="Buy milk" cells={["Status: Open", "Rank: 2"]} onPress={open} />
      </Section>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Buy milk, Status: Open, Rank: 2" }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("header", { name: "Notes" })).toBeOnTheScreen();
  });
});

describe("Theme", () => {
  test("the same component reads the mode's own colours", async () => {
    await inTheme(<Text tone="muted">x</Text>, "light");
    expect(screen.getByText("x")).toHaveStyle({ color: palette.light.textMuted });
    await screen.unmount();
    await inTheme(<Text tone="muted">x</Text>, "dark");
    expect(screen.getByText("x")).toHaveStyle({ color: palette.dark.textMuted });
  });
});

describe("TagsField", () => {
  test("what is typed is part of the value, so a save that never blurred it carries it", async () => {
    const onChange = jest.fn();
    await inTheme(<TagsField label="Tags" value="alpha, beta, " onChange={onChange} />);
    // A value this control wrote reads back as its chips and what is being typed.
    expect(screen.getByRole("button", { name: "Remove alpha" })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("tags-tags"), "gam");
    expect(onChange).toHaveBeenCalledWith("alpha, beta, gam");
  });

  test("a record's own list is all chips, none of it half-typed", async () => {
    const onChange = jest.fn();
    await inTheme(<TagsField label="Tags" value="alpha, beta" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Remove beta" })).toBeOnTheScreen();
    expect(screen.getByTestId("tags-tags")).toHaveDisplayValue("");
    await fireEvent.press(screen.getByRole("button", { name: "Remove alpha" }));
    expect(onChange).toHaveBeenCalledWith("beta, ");
  });
});
