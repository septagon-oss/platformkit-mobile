// How a list is being read is asked in two sheets under its header, and this file reads
// them as a person does. The sort sheet shows every order the list was offered — one row
// each, the row standing on the answer marked — and pressing one both sets that order and
// closes the sheet, because choosing is the whole answer. The filters sheet leads each
// group with "All", never offers a reset inside a group, stays open while a value is
// picked, and offers the one action that empties them only when something is filtered. A
// sheet that is closed puts no choice on screen; the toolbar's word stays either way. Each
// group's choices name the group they belong to, and the bar that holds both doors is read
// by its own name, not by the name of one door.
import React from "react";
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { parseCatalog, type Entry, type Field } from "../../src/core/catalog";
import type { Order } from "../../src/core/derive";
import { ResourceList } from "../../src/ui/organisms/ResourceList";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const note = parseCatalog(JSON.parse(readFileSync("testdata/catalog.json", "utf8"))).resources.find(
  (r) => r.entity === "note",
)!;
const rows = [{ id: "1", title: "Buy milk", status: "open" }];
const none = () => undefined;

/** The list screen with its sheet open: what a person who tapped a control sees. */
function list(
  entry: Entry,
  order: Order,
  sheet: "none" | "sort" | "filters",
  onSheet = jest.fn(),
  onOrder = jest.fn(),
) {
  return render(
    <ThemeProvider mode="light">
      <ResourceList
        presentation={presentation}
        entry={entry}
        rows={rows}
        total={rows.length}
        loading={false}
        refreshing={false}
        more={false}
        error=""
        order={order}
        sheet={sheet}
        onSheet={onSheet}
        onOrder={onOrder}
        onOpen={none}
        onMore={none}
        onRefresh={none}
      />
    </ThemeProvider>,
  );
}

describe("the sort sheet", () => {
  test("an open sheet offers every order as one row and marks the one in force", async () => {
    await list(note, { sort: "title", filters: {} }, "sort");
    const offered = screen.getAllByRole("radio");
    // Newest, oldest, and the one field this entry can be ordered by both ways:
    // four rows, not the fifteen-chip wall they replace.
    expect(offered).toHaveLength(4);
    expect(offered.map((row) => row.props.accessibilityState?.selected)).toEqual([
      false,
      false,
      true,
      false,
    ]);
    expect(screen.getByText("Newest first")).toBeOnTheScreen();
    expect(screen.getByText("Title, Z–A")).toBeOnTheScreen();
  });

  test("pressing a row sets the order it names and closes the sheet it was in", async () => {
    const onSheet = jest.fn();
    const onOrder = jest.fn();
    await list(note, { sort: "", filters: { status: "done" } }, "sort", onSheet, onOrder);
    await fireEvent.press(screen.getByRole("radio", { name: "Oldest first" }));
    expect(onOrder).toHaveBeenCalledWith({ sort: "createdAt", filters: { status: "done" } });
    expect(onSheet).toHaveBeenCalledWith("none");
  });

  test("a closed sheet puts no choice on screen and leaves the toolbar's word standing", async () => {
    await list(note, { sort: "", filters: {} }, "none");
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Sort" })).toBeOnTheScreen();
  });
});

describe("the filters sheet", () => {
  test("every group leads with All and carries no reset of its own", async () => {
    await list(note, { sort: "", filters: {} }, "filters");
    const offered = screen.getAllByRole("radio");
    expect(offered[0]!.props.accessibilityState?.selected).toBe(true);
    expect(offered.every((row) => row.props.accessibilityState?.selected !== undefined)).toBe(true);
    // "Clear" is the word for a reset, and no group here needs one: the answer to
    // "narrow nothing" is one of the choices, named All.
    expect(screen.queryByText("Clear")).toBeNull();
    expect(screen.queryByText("Clear filters")).toBeNull();
  });

  test("a chosen value applies at once and keeps the sheet open; clearing keeps the sort", async () => {
    const onSheet = jest.fn();
    const onOrder = jest.fn();
    await list(note, { sort: "title", filters: { status: "done" } }, "filters", onSheet, onOrder);
    await fireEvent.press(screen.getByRole("radio", { name: "Open" }));
    expect(onOrder).toHaveBeenCalledWith({ sort: "title", filters: { status: "open" } });
    expect(onSheet).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Clear filters" }));
    expect(onOrder).toHaveBeenLastCalledWith({ sort: "title", filters: {} });
  });

  test("each field to narrow by gets a group whose choices name it", async () => {
    // A test id that names no group puts `filters/all` on the screen twice the moment
    // an entry holds two closed sets, and a journey that taps one would be told it
    // matched two. Nothing this repository serves has two enums yet, so the second
    // one is written here rather than left to a fixture nobody reads.
    const room: Field = { name: "room", type: "string", enum: ["kitchen", "cellar"] };
    const two: Entry = { ...note, fields: [...note.fields, room] };
    await list(two, { sort: "", filters: {} }, "filters");
    expect(screen.getByTestId("filters-status/value%3Aopen")).toBeOnTheScreen();
    expect(screen.getByTestId("filters-room/value%3Akitchen")).toBeOnTheScreen();
  });
});

describe("the toolbar under the header", () => {
  test("the bar is named for itself and its two doors keep their own words", async () => {
    // `ActionBar` names the group a reader hears. Named "Sort", the bar would say it
    // *is* its Sort button, and the Filters door would sit under the wrong name.
    await list(note, { sort: "", filters: {} }, "none");
    expect(screen.getByTestId("list-toolbar").props.accessibilityLabel).toBe("List controls");
    expect(screen.getByRole("button", { name: "Sort" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Filters" })).toBeOnTheScreen();
  });

  test("the toolbar counts what its sheet can clear", async () => {
    const rendered = await list(note, { sort: "", filters: {} }, "none");
    expect(screen.getByRole("button", { name: "Filters" })).toBeOnTheScreen();
    await rendered.rerender(
      <ThemeProvider mode="light">
        <ResourceList
          presentation={presentation}
          entry={note}
          rows={rows}
          total={rows.length}
          loading={false}
          refreshing={false}
          more={false}
          error=""
          order={{ sort: "", filters: { status: "done" } }}
          sheet="none"
          onSheet={jest.fn()}
          onOrder={jest.fn()}
          onOpen={none}
          onMore={none}
          onRefresh={none}
        />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: "Filters · 1" })).toBeOnTheScreen();
  });
});
