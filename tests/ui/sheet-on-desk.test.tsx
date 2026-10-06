// A capture of the sheet page at 1440 named what the kit's own surface does in a
// browser: "a narrow, full-height beige column floats between white margins; its
// content ends near the top while Next sits at the bottom of a vast empty area".
// `flex: 1` is right on a device, where the sheet is the system's and holds the
// screen; on a desk it makes the surface fill the viewport, so its foot's action
// lands a screenful below the sentence it belongs to and the page behind it is
// hidden by the browser's own white. Here the sheet is set down as a dialog: the
// height of what it holds, on the page it opened from.
import React from "react";
import { Platform, Text } from "react-native";
import { expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { kitExamples } from "../../src/core/derive";
import { DetailSheet } from "../../src/ui/templates/DetailSheet";
import { themeFor, ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const model = (() => {
  const result = kitExamples(presentation, "detail-sheet/open");
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value.surface;
})();

const sheet = () => (
  <ThemeProvider mode="light">
    <DetailSheet model={model} onRequestClose={() => {}} testID="sheet">
      <Text>Admission summary</Text>
    </DetailSheet>
  </ThemeProvider>
);

test("a sheet opened in a browser is a dialog sized to its content over a dimmed page", async () => {
  const restore = jest.replaceProperty(Platform, "OS", "web");
  try {
    await render(sheet());
    const body = screen.getByTestId("sheet");
    // The surface stops growing at its content and stops rising at most of the
    // canvas: an action it carries sits under the words it acts on, not at the
    // foot of the viewport.
    expect(body).toHaveStyle({ flexGrow: 0, flexBasis: "auto", maxHeight: "82%" });
    // The canvas behind it is the kit's scrim — the page kept back — and not the
    // browser's white, which hid where the person had come from.
    const scrim = themeFor("light").state.scrim;
    expect(scrim).not.toBe("#ffffff");
    expect(body.parent).toHaveStyle({ backgroundColor: scrim, justifyContent: "center" });
    expect(screen.getByText("Admission summary")).toBeTruthy();
  } finally {
    restore.restore();
  }
});

test("a sheet on a device keeps the system's screen and no backdrop of ours", async () => {
  await render(sheet());
  const body = screen.getByTestId("sheet");
  expect(body).not.toHaveStyle({ maxHeight: "82%" });
  expect(body).not.toHaveStyle({ backgroundColor: themeFor("light").state.scrim });
});
