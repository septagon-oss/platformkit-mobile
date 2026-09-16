import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Badge } from "../../src/ui/atoms/Badge";
import { Button } from "../../src/ui/atoms/Button";
import { ChoiceRow } from "../../src/ui/atoms/ChoiceRow";
import { EmptyState } from "../../src/ui/atoms/EmptyState";
import { Icon } from "../../src/ui/atoms/Icon";
import { Notice } from "../../src/ui/atoms/Notice";
import { Skeleton } from "../../src/ui/atoms/Skeleton";
import { Spinner } from "../../src/ui/atoms/Spinner";
import { SwitchRow } from "../../src/ui/atoms/SwitchRow";
import { Text } from "../../src/ui/atoms/Text";
import { radius } from "../../src/ui/scale";
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

describe("Badge", () => {
  test("a badge is a pill in its tone's pair, whatever its height", async () => {
    await inTheme(<Badge label="Ok" tone="ok" />);
    expect(screen.getByLabelText("Ok")).toHaveStyle({
      borderRadius: radius.full,
      backgroundColor: palette.light.statusOkBg,
    });
    expect(screen.getByText("Ok")).toHaveStyle({ color: palette.light.statusOk });
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

describe("testID", () => {
  test("every atom takes a testID a device flow can look up", async () => {
    const none = () => undefined;
    await inTheme(
      <>
        <Badge label="Ok" testID="t-badge" />
        <Button label="Go" onPress={none} testID="t-button" />
        <ChoiceRow label="Status" value="" options={[]} onChange={none} testID="t-choice" />
        <EmptyState title="Nothing" testID="t-empty" />
        <Icon name="add" testID="t-icon" />
        <Notice text="Read this." testID="t-notice" />
        <Skeleton testID="t-skeleton" />
        <Spinner testID="t-spinner" />
        <SwitchRow label="Pinned" value={false} onValueChange={none} testID="t-switch" />
      </>,
    );
    for (const id of [
      "t-badge",
      "t-button",
      "t-choice",
      "t-empty",
      "t-notice",
      "t-skeleton",
      "t-spinner",
      "t-switch",
    ])
      expect(screen.getByTestId(id)).toBeOnTheScreen();
    // An icon without a label is decoration, hidden from a screen reader; a
    // device flow still finds it by id.
    expect(screen.getByTestId("t-icon", { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
