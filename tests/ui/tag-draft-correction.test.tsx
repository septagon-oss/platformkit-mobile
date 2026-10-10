import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React, { useState } from "react";
import { splitList } from "../../src/core/derive";
import { TagsField } from "../../src/ui/molecules/TagsField";
import { ThemeProvider } from "../../src/ui/theme";
import { feedback } from "../fakes/presentation";

test("correcting a refused tag replaces the draft without storing its accepted prefix", async () => {
  const wrote = jest.fn<(value: string) => void>();
  function Form() {
    const [held, setHeld] = useState("alpha, ");
    return (
      <TagsField
        label="Tags"
        value={held}
        copy={feedback.copy.kit}
        onChange={(value) => {
          setHeld(value);
          wrote(value);
        }}
      />
    );
  }
  await render(
    <ThemeProvider mode="light">
      <Form />
    </ThemeProvider>,
  );
  await fireEvent.changeText(screen.getByTestId("tags-tags"), "be");
  await fireEvent.changeText(screen.getByTestId("tags-tags"), "be,ta");
  expect(screen.getByTestId("tags-tags")).toHaveDisplayValue("be,ta");
  await fireEvent.changeText(screen.getByTestId("tags-tags"), "beta");
  await fireEvent.press(screen.getByRole("button", { name: "Add to Tags" }));
  expect(splitList(wrote.mock.calls.at(-1)![0])).toEqual(["alpha", "beta"]);
});
