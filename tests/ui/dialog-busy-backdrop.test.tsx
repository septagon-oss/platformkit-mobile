// While the confirmed write is under way the dialog's cancel is off (Button
// busy). The backdrop and the platform's back gesture are the same cancel by
// another route, so they are off too: a dialog that can be dismissed mid-write
// leaves the screen saying nothing about a write that is still happening.
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { ConfirmDialog } from "../../src/ui/molecules/ConfirmDialog";
import { ThemeProvider } from "../../src/ui/theme";

test("a busy dialog keeps every cancel route off", async () => {
  const onCancel = jest.fn();
  await render(
    <ThemeProvider mode="light">
      <ConfirmDialog
        open
        busy
        tone="destructive"
        title="Archive the board"
        body="Its cards leave every list."
        confirm="Archive"
        cancel="Stay"
        onConfirm={() => undefined}
        onCancel={onCancel}
        testID="archive"
      />
    </ThemeProvider>,
  );
  // Reached through the fixed behaviour's own surface: the card is drawn.
  expect(screen.getByTestId("archive-card")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("archive-backdrop"));
  await fireEvent(screen.getByTestId("archive"), "requestClose");
  expect(onCancel).not.toHaveBeenCalled();
});
