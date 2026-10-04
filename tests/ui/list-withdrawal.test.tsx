import React from "react";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { deriveCopy, deriveDataList, deriveState, type DataListInput } from "../../src/core/derive";
import { DataList } from "../../src/ui/organisms/DataList";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

test.each([
  { language: "en", mode: "light" },
  { language: "en", mode: "dark" },
  { language: "pt", mode: "light" },
  { language: "pt", mode: "dark" },
] as const)(
  "$language/$mode list withdrawal removes old controls and recovery needs an explicit selection",
  async ({ language, mode }) => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const onBulkAction = jest.fn(),
      onSelection = jest.fn(),
      onMore = jest.fn();
    const input: DataListInput = {
      content: {
        phase: "ready",
        refresh: "idle",
        value: [
          {
            id: "loaded",
            title: "Loaded records",
            collapsible: false,
            rows: [{ id: "record-a", title: "Record A", cells: [], selectable: true, actions: [] }],
          },
        ],
      },
      order: { sort: "", filters: {} },
      filters: [],
      views: [],
      viewDirty: false,
      selection: "multiple",
      selectedIds: ["record-a"],
      collapsedIds: [],
      bulkActions: [{ id: "archive", label: "Archive", state: "ready", tone: "primary" }],
      page: { more: true, loading: false },
    };
    const view = (value: DataListInput) => {
      const derived = deriveDataList(value, p);
      if (!derived.ok) throw new Error(JSON.stringify(derived.issues));
      return (
        <ThemeProvider mode={mode}>
          <DataList
            model={derived.value}
            testID="review-list"
            onBulkAction={onBulkAction}
            onSelection={onSelection}
            onMore={onMore}
          />
        </ThemeProvider>
      );
    };
    await render(view(input));
    await fireEvent.press(screen.getByRole("button", { name: "Archive" }));
    expect(onBulkAction.mock.calls).toEqual([["archive", ["record-a"]]]);
    onBulkAction.mockClear();

    for (const code of ["forbidden", "not-found"] as const) {
      const state = deriveState(
        {
          kind: "error",
          issue: { code, path: "list", recovery: "immutable", message: p.copy.kit.unavailable },
        },
        p,
      );
      if (!state.ok) throw new Error(JSON.stringify(state.issues));
      await screen.rerender(view({ ...input, content: { phase: "error", state: state.value } }));
      // Reach the assertions through the list container, independently of refusal copy.
      expect(screen.getByTestId("review-list")).toBeOnTheScreen();
      expect(screen.queryByText("Record A", { includeHiddenElements: true })).toBeNull();
      expect(screen.queryByRole("checkbox", { name: `${p.copy.kit.select}: Record A` })).toBeNull();
      for (const name of ["Archive", p.copy.kit.more]) {
        const button = screen.getByRole("button", { name });
        expect(button).toBeDisabled();
        await fireEvent.press(button);
        await fireEvent(button, "accessibilityAction", { nativeEvent: { actionName: "activate" } });
      }
      const all = screen.getByRole("checkbox", { name: p.copy.kit.allLoaded });
      expect(all).toBeDisabled();
      await fireEvent.press(all);
      expect(onBulkAction).not.toHaveBeenCalled();
      expect(onSelection).not.toHaveBeenCalled();
      expect(onMore).not.toHaveBeenCalled();
    }

    await screen.rerender(view({ ...input, selectedIds: [] }));
    expect(screen.getByText("Record A")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
    expect(onSelection).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("checkbox", { name: `${p.copy.kit.select}: Record A` }));
    expect(onSelection.mock.calls).toEqual([[["record-a"]]]);
    expect(onBulkAction).not.toHaveBeenCalled();
    await screen.rerender(view(input));
    await fireEvent.press(screen.getByRole("button", { name: "Archive" }));
    expect(onBulkAction.mock.calls).toEqual([["archive", ["record-a"]]]);
  },
);
