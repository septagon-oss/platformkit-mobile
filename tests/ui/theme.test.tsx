import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Button } from "../../src/ui/atoms/Button";
import { Text } from "../../src/ui/atoms/Text";
import { ThemeProvider, type Fonts } from "../../src/ui/theme";
import { palette } from "../../src/ui/tokens";

const client = {
  light: { ...palette.light, accentDefault: palette.light.statusInfo },
  dark: { ...palette.dark, accentDefault: palette.dark.statusWarning },
};
const fonts: Fonts = { display: "Georgia", body: "Courier", mono: "Menlo" };

test("a client palette reaches shared components in both modes with its resolved native faces", async () => {
  const view = (mode: "light" | "dark") => (
    <ThemeProvider mode={mode} palette={client} fonts={fonts}>
      <Button label="Continue" onPress={() => undefined} />
      <Text role="display">Title</Text>
      <Text>Body</Text>
      <Text role="mono">Identifier</Text>
    </ThemeProvider>
  );
  await render(view("light"));
  expect(screen.getByRole("button", { name: "Continue" })).toHaveStyle({
    backgroundColor: client.light.accentDefault,
  });
  expect(screen.getByText("Title")).toHaveStyle({ fontFamily: fonts.display });
  expect(screen.getByText("Body")).toHaveStyle({ fontFamily: fonts.body });
  expect(screen.getByText("Identifier")).toHaveStyle({ fontFamily: fonts.mono });
  await screen.rerender(view("dark"));
  expect(screen.getByRole("button", { name: "Continue" })).toHaveStyle({
    backgroundColor: client.dark.accentDefault,
  });
  expect(screen.getByText("Continue")).toHaveStyle({ color: client.dark.accentOn });
});

test("replacing palette and faces in the same mode refreshes memoized styles and preserves actions", async () => {
  const pressed = jest.fn();
  await render(
    <ThemeProvider mode="light" palette={client} fonts={fonts}>
      <Button label="Continue" onPress={pressed} />
      <Text>Body</Text>
    </ThemeProvider>,
  );
  await screen.rerender(
    <ThemeProvider mode="light" palette={palette} fonts={fonts}>
      <Button label="Continue" onPress={pressed} />
      <Text>Body</Text>
    </ThemeProvider>,
  );
  expect(screen.getByRole("button", { name: "Continue" })).toHaveStyle({
    backgroundColor: palette.light.accentDefault,
  });
  expect(screen.getByText("Body")).toHaveStyle({ fontFamily: fonts.body });
  await screen.rerender(
    <ThemeProvider mode="light" palette={palette} fonts={{ ...fonts, body: "Georgia" }}>
      <Button label="Continue" onPress={pressed} />
      <Text>Body</Text>
    </ThemeProvider>,
  );
  const button = screen.getByRole("button", { name: "Continue" });
  expect(button).toHaveStyle({ backgroundColor: palette.light.accentDefault });
  expect(screen.getByText("Body")).toHaveStyle({ fontFamily: "Georgia" });
  await fireEvent.press(button);
  expect(pressed).toHaveBeenCalledTimes(1);
});

test("a client provider leaves a separate reference provider on its own palette", async () => {
  await render(
    <>
      <ThemeProvider mode="dark" palette={client}>
        <Button label="Client" onPress={() => undefined} />
      </ThemeProvider>
      <ThemeProvider mode="dark">
        <Button label="Reference" onPress={() => undefined} />
      </ThemeProvider>
    </>,
  );
  expect(screen.getByRole("button", { name: "Client" })).toHaveStyle({
    backgroundColor: client.dark.accentDefault,
  });
  expect(screen.getByRole("button", { name: "Reference" })).toHaveStyle({
    backgroundColor: palette.dark.accentDefault,
  });
});
