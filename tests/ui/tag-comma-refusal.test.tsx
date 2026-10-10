import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { TagsField } from "../../src/ui/molecules/TagsField";
import { ThemeProvider } from "../../src/ui/theme";
import { feedback } from "../fakes/presentation";

test.each(["alpha,", ",alpha", ",", "alpha,,"])(
  "a tag containing a comma is refused even when splitting leaves one or no words: %s",
  async (value) => {
    const wrote = jest.fn();
    const refused = jest.fn();
    await render(
      <ThemeProvider mode="light">
        <TagsField
          label="Tags"
          value=""
          onChange={wrote}
          onRefused={refused}
          copy={feedback.copy.kit}
        />
      </ThemeProvider>,
    );
    await fireEvent.changeText(screen.getByTestId("tags-tags"), value);
    await fireEvent(screen.getByTestId("tags-tags"), "submitEditing");
    expect(screen.getByTestId("tags-tags")).toHaveDisplayValue(value);
    expect(wrote).not.toHaveBeenCalled();
    expect(refused).toHaveBeenLastCalledWith(true);
    expect(screen.getByTestId("tags-fault-tags")).toHaveTextContent(feedback.copy.kit.commaInValue);
  },
);
