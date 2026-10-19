// Nothing a swipe can do may be swipe-only. The command a row's swipe runs is offered to a reader
// as a named action of the row itself, the row's own name keeps the words it always had, and a row
// of an entry that names no command is the same row it was — with no surface standing under it
// until a product supplies one.
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { readFileSync } from "node:fs";
import type { Entry } from "../../src/core/catalog";
import { parseCatalog } from "../../src/core/catalog";
import { noOrder } from "../../src/core/derive";
import { ResourceList } from "../../src/ui/organisms/ResourceList";
import { presentation } from "../fakes/presentation";
import { RowSwipe } from "../fakes/gesture";

const golden = () =>
  JSON.parse(readFileSync("testdata/catalog.json", "utf8")) as Record<string, unknown>;

/** the golden's note, with the record verb its rows would run, and the words it says about it. */
function entry(): Entry {
  const doc = golden();
  const note = (doc.resources as Record<string, unknown>[])[0]!;
  const commands = note.commands as Record<string, unknown>[];
  commands.push({ verb: "resolve", summary: "Resolve the note" });
  note.presentation = { primaryCommand: "resolve" };
  return parseCatalog(doc).resources.find((r) => r.entity === "note")!;
}

const rows = [{ id: "7", title: "Buy the milk", status: "open", rank: 1, pinned: false, tags: [] }];
const none = () => undefined;

/** the generated list, on an entry that may or may not name a row command. */
function list(over: { onRowRun?: (id: string) => void; renderRowAction?: boolean } = {}) {
  return render(
    <ResourceList
      presentation={presentation}
      entry={entry()}
      rows={rows}
      total={1}
      loading={false}
      refreshing={false}
      more={false}
      error=""
      order={noOrder}
      onOrder={none}
      onOpen={none}
      onMore={none}
      onRefresh={none}
      {...(over.onRowRun ? { onRowRun: over.onRowRun } : {})}
      {...(over.renderRowAction ? { renderRowAction: RowSwipe } : {})}
    />,
  );
}

const row = () => screen.getByTestId("row-7");

describe("the row's command, with no finger", () => {
  test("a reader is offered the same command the swipe runs, on the row it belongs to", async () => {
    const onRowRun = jest.fn<() => void>();
    await list({ onRowRun });
    fireEvent(row(), "accessibilityAction", { nativeEvent: { actionName: "run" } });
    expect(onRowRun).toHaveBeenCalledTimes(1);
  });

  test("the command is something the row offers, not a fact added to its name", async () => {
    await list({ onRowRun: () => undefined });
    const heard = String(row().props.accessibilityLabel);
    expect(heard.startsWith("Buy the milk")).toBe(true);
    expect(heard).not.toMatch(/resolve/i);
  });

  test("an action that is not the row's own asks nothing of the phone", async () => {
    const onRowRun = jest.fn<() => void>();
    await list({ onRowRun });
    fireEvent(row(), "accessibilityAction", { nativeEvent: { actionName: "activate" } });
    expect(onRowRun).not.toHaveBeenCalled();
  });

  test("a row of an entry that names no command is offered nothing, and is otherwise the same row", async () => {
    const doc = golden();
    const note = (doc.resources as Record<string, unknown>[])[0]!;
    note.presentation = {};
    const quiet = parseCatalog(doc).resources.find((r) => r.entity === "note")!;
    await render(
      <ResourceList
        presentation={presentation}
        entry={quiet}
        rows={rows}
        total={1}
        loading={false}
        refreshing={false}
        more={false}
        error=""
        order={noOrder}
        onOrder={none}
        onOpen={none}
        onMore={none}
        onRefresh={none}
      />,
    );
    expect(row().props.accessibilityActions).toBeUndefined();
    expect(screen.queryByTestId("swipe-resolve")).toBeNull();
  });

  test("no surface stands under a row until the product supplies one", async () => {
    await list({ onRowRun: () => undefined });
    expect(screen.queryByTestId("swipe-resolve")).toBeNull();
  });

  test("the command the product's surface reveals is the entry's own verb", async () => {
    await list({ onRowRun: () => undefined, renderRowAction: true });
    expect(screen.getByTestId("swipe-resolve")).toBeTruthy();
  });
});
