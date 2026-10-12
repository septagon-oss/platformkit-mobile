import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React, { useState } from "react";
import { splitList } from "../../src/core/derive";
import { TagsField } from "../../src/ui/molecules/TagsField";
import { ThemeProvider } from "../../src/ui/theme";
import { feedback } from "../fakes/presentation";

test.each(["return", "add"])(
  "correcting a refused draft after removing chips preserves only intended tags with %s",
  async (commit) => {
    const wrote = jest.fn<(value: string) => void>();
    const refused = jest.fn<(value: boolean) => void>();
    function Form() {
      const [held, setHeld] = useState("north, south, ");
      return (
        <TagsField
          label="Tags"
          value={held}
          copy={feedback.copy.kit}
          onRefused={refused}
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
    const input = () => screen.getByTestId("tags-tags");
    await fireEvent.changeText(input(), "we");
    wrote.mockClear();
    await fireEvent.changeText(input(), "we,");
    await fireEvent(input(), "submitEditing");
    expect(wrote).not.toHaveBeenCalled();
    expect(refused).toHaveBeenLastCalledWith(true);
    await fireEvent.press(screen.getByRole("button", { name: "Remove north" }));
    expect(splitList(wrote.mock.calls.at(-1)![0])).toEqual(["south", "we"]);
    expect(input()).toHaveDisplayValue("we,");
    expect(screen.getByTestId("tags-fault-tags")).toHaveTextContent(feedback.copy.kit.commaInValue);
    await fireEvent.changeText(input(), "west");
    await fireEvent.changeText(input(), ",west");
    await fireEvent.press(screen.getByRole("button", { name: "Remove south" }));
    expect(input()).toHaveDisplayValue(",west");
    await fireEvent.changeText(input(), "westward");
    if (commit === "return") await fireEvent(input(), "submitEditing");
    else await fireEvent.press(screen.getByRole("button", { name: "Add to Tags" }));
    expect(splitList(wrote.mock.calls.at(-1)![0])).toEqual(["westward"]);
    expect(refused).toHaveBeenLastCalledWith(false);
    expect(input()).toHaveDisplayValue("");
    expect(screen.queryByTestId("tags-fault-tags")).toBeNull();
  },
);
