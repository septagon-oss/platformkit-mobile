import React from "react";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { Entry } from "../../src/core/catalog";
import { deriveCopy, noOrder } from "../../src/core/derive";
import { ResourceList } from "../../src/ui/organisms/ResourceList";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const entry: Entry = {
  module: "note",
  entity: "note",
  path: "/api/v1/note/notes",
  writable: false,
  singleton: false,
  immutable: [],
  commands: [],
  fields: [
    { name: "id", type: "uuid", readOnly: true },
    { name: "title", type: "string" },
    { name: "createdAt", type: "time", readOnly: true },
  ],
};

test.each([
  { language: "en", locale: "en-GB", shown: "2 days ago", exact: "27 Mar 2026, 18:15" },
  { language: "pt", locale: "pt-PT", shown: "Anteontem", exact: "27/03/2026, 18:15" },
] as const)(
  "$language generated list announces the exact local instant through its composed row",
  async ({ language, locale, shown, exact }) => {
    const open = jest.fn();
    await render(
      <ThemeProvider mode="light">
        <ResourceList
          presentation={{
            ...presentation,
            copy: deriveCopy(language),
            locale,
            timeZone: "Europe/Lisbon",
            ownZone: "Europe/Lisbon",
            now: "2026-03-29T08:00:00Z",
          }}
          entry={entry}
          rows={[{ id: "note-a", title: "Arrival", createdAt: "2026-03-27T18:15:00Z" }]}
          total={1}
          loading={false}
          refreshing={false}
          more={false}
          error=""
          order={noOrder}
          ordering={false}
          onOrder={jest.fn()}
          onOpen={open}
          onMore={jest.fn()}
          onRefresh={jest.fn()}
        />
      </ThemeProvider>,
    );
    // Reach the record by its stable identity, independently of either time spelling.
    const row = screen.getByTestId("row-note-a");
    expect(screen.getByText(`Created at: ${shown}`)).toBeOnTheScreen();
    expect(row.props.accessibilityLabel).toBe(`Arrival, Created at: ${exact}`);
    await fireEvent.press(row);
    expect(open).toHaveBeenCalledWith("note-a");
  },
);
