import { expect, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Gallery } from "../../src/ui/gallery";
import { presentation } from "../fakes/presentation";

// The activity trail is titled by its own model, in the kit's own word for it, because a
// real screen needs that heading and nothing above it. The gallery page also names the
// family above the specimen it draws. Both read "Activity", and whoever walks the screen
// by its headings meets the same one twice.
test("a specimen that titles itself is not titled a second time by the page", async () => {
  await render(<Gallery presentation={presentation} page="list" />);
  expect(screen.getByTestId("gallery-page:list")).toBeOnTheScreen();
  fireEvent.press(screen.getByTestId("gallery-page-later-states"));
  expect(await screen.findAllByText(/^Activity$/i)).toHaveLength(1);
});
