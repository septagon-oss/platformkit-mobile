import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { deriveSearch } from "../../src/core/navigation";
import { SearchField } from "../../src/ui/molecules/SearchField";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

test("a busy search blocks submission until the pending search completes", async () => {
  const onSubmit = jest.fn();
  const view = (busy: boolean) => {
    const result = deriveSearch({ value: "books", placeholder: "Find books", busy }, presentation);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    return (
      <ThemeProvider mode="light">
        <SearchField model={result.value} onChangeText={() => undefined} onSubmit={onSubmit} />
      </ThemeProvider>
    );
  };
  await render(view(false));
  await fireEvent(screen.getByLabelText(presentation.copy.kit.search), "submitEditing");
  expect(onSubmit).toHaveBeenCalledTimes(1);
  onSubmit.mockClear();
  await screen.rerender(view(true));
  await fireEvent(screen.getByLabelText(presentation.copy.kit.search), "submitEditing");
  expect(onSubmit).not.toHaveBeenCalled();
  await screen.rerender(view(false));
  await fireEvent(screen.getByLabelText(presentation.copy.kit.search), "submitEditing");
  expect(onSubmit).toHaveBeenCalledTimes(1);
});
