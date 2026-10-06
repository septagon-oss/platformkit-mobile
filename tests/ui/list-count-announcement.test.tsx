import React from "react";
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { deriveCopy, deriveDataList, type DataListInput } from "../../src/core/derive";
import { DataList } from "../../src/ui/organisms/DataList";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

test.each([
  { language: "en", count: "3 of 7" },
  { language: "pt", count: "3 de 7" },
] as const)(
  "$language announces a lone group's count once and withdraws it while loading",
  async ({ language, count }) => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const input: DataListInput = {
      content: {
        phase: "ready",
        refresh: "idle",
        value: [
          {
            id: "appointments",
            title: "Appointments",
            total: 7,
            collapsible: false,
            rows: ["Morning", "Afternoon", "Evening"].map((title) => ({
              id: title,
              title,
              cells: [],
              selectable: false,
              actions: [],
            })),
          },
        ],
      },
      order: { sort: "", filters: {} },
      filters: [],
      views: [],
      viewDirty: false,
      selection: "none",
      selectedIds: [],
      collapsedIds: [],
      bulkActions: [],
      page: { more: false, loading: false },
    };
    const view = (content: DataListInput["content"]) => {
      const result = deriveDataList({ ...input, content }, p);
      if (!result.ok) throw new Error(JSON.stringify(result.issues));
      return (
        <ThemeProvider mode="light">
          <DataList model={result.value} testID="appointment-list" />
        </ThemeProvider>
      );
    };
    await render(view(input.content));
    expect(screen.getByText("Morning")).toBeOnTheScreen();
    expect(screen.getAllByText(count)).toHaveLength(1);
    expect(screen.getByText(count).props.accessibilityLiveRegion).toBe("polite");
    await screen.rerender(view({ phase: "loading" }));
    expect(screen.getByTestId("appointment-list")).toBeOnTheScreen();
    expect(screen.queryByText(count, { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByText("Morning", { includeHiddenElements: true })).toBeNull();
    await screen.rerender(view(input.content));
    expect(screen.getByText("Evening")).toBeOnTheScreen();
    expect(screen.getAllByText(count)).toHaveLength(1);
  },
);
