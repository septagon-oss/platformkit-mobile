// The busy dialog keeps every cancel route off (dialog-busy-backdrop.test.tsx).
// An idle one owes the opposite: the backdrop, the platform's back gesture and
// the Cancel button are the same cancel, and a dialog that refused all three
// while idle would trap the person in it. Measured from the fixed behaviour's
// own surface, so a cure that turns cancel off everywhere fails here.
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { ConfirmDialog } from "../../src/ui/molecules/ConfirmDialog";
import { ThemeProvider } from "../../src/ui/theme";

test("an idle dialog cancels from the button, the backdrop and the back gesture", async () => {
  const onCancel = jest.fn();
  await render(
    <ThemeProvider mode="light">
      <ConfirmDialog
        open
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
  await fireEvent.press(screen.getByTestId("archive-cancel"));
  await fireEvent.press(screen.getByTestId("archive-backdrop"));
  await fireEvent(screen.getByTestId("archive"), "requestClose");
  expect(onCancel).toHaveBeenCalledTimes(3);
});
