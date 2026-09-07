import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import { formControls, noOrder, sortOptions } from "../../src/core/derive";
import { Home } from "../../src/ui/organisms/Home";
import { ResourceDetail } from "../../src/ui/organisms/ResourceDetail";
import { ResourceForm } from "../../src/ui/organisms/ResourceForm";
import { ResourceList } from "../../src/ui/organisms/ResourceList";
import { SignInForm } from "../../src/ui/organisms/SignInForm";
import { ThemeProvider } from "../../src/ui/theme";

const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
const note = catalog.resources.find((r) => r.entity === "note")!;
const inTheme = (el: React.ReactElement) =>
  render(<ThemeProvider mode="light">{el}</ThemeProvider>);
const none = () => undefined;

describe("ResourceList", () => {
  const rows = [
    { id: "1", title: "Buy milk", status: "open", rank: 2, pinned: false, tags: [] },
    { id: "2", title: "Call home", status: "done", rank: 1, pinned: true, tags: ["a"] },
  ];
  const props = {
    entry: note,
    rows,
    total: 2,
    loading: false,
    refreshing: false,
    more: false,
    error: "",
    order: noOrder,
    ordering: false,
    onOrder: none,
    onMore: none,
    onRefresh: none,
  };

  test("a row is its name and what tells it apart, and opens by id", async () => {
    const onOpen = jest.fn();
    await inTheme(<ResourceList {...props} onOpen={onOpen} />);
    // The cells are the closed set, the yes-or-no and the number, in that
    // order: not the times every record has.
    await fireEvent.press(
      screen.getByRole("button", { name: "Buy milk, Status: Open, Pinned: No, Rank: 2" }),
    );
    expect(onOpen).toHaveBeenCalledWith("1");
  });

  test("an empty list offers the first one only to a caller who may write", async () => {
    const onNew = jest.fn();
    await inTheme(<ResourceList {...props} rows={[]} total={0} onOpen={none} onNew={onNew} />);
    await fireEvent.press(screen.getByRole("button", { name: "New note" }));
    expect(onNew).toHaveBeenCalledTimes(1);
    await screen.unmount();
    await inTheme(<ResourceList {...props} rows={[]} total={0} onOpen={none} />);
    expect(screen.queryByRole("button", { name: "New note" })).toBeNull();
  });

  test("the orders offered are newest, oldest and each visible column both ways", () => {
    const labels = sortOptions(note).map((o) => o.label);
    expect(labels.slice(0, 2)).toEqual(["Newest first", "Oldest first"]);
    expect(labels).toContain("Title, ascending");
  });
});

describe("ResourceForm", () => {
  const controls = formControls(note, undefined, true);
  const base = { controls, held: {}, errors: {}, detail: "", onChange: none, onRetry: none };

  test("while the row loads there is nothing to type into", async () => {
    await inTheme(<ResourceForm {...base} phase="loading" />);
    expect(screen.queryByTestId("input-title")).toBeNull();
    expect(screen.getByRole("progressbar")).toBeOnTheScreen();
  });

  test("the refusal sits under the control it is about, and the general one at the top", async () => {
    await inTheme(
      <ResourceForm
        {...base}
        phase="editing"
        errors={{ title: "is required" }}
        detail="a note needs a title"
      />,
    );
    expect(screen.getByText("is required")).toBeOnTheScreen();
    expect(screen.getByRole("alert")).toHaveTextContent(/a note needs a title/);
  });

  test("while saving, every control is off", async () => {
    await inTheme(<ResourceForm {...base} phase="saving" />);
    expect(screen.getByTestId("input-title")).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Pinned" })).toBeDisabled();
  });

  test("a failed load offers a retry and no controls", async () => {
    const onRetry = jest.fn();
    await inTheme(<ResourceForm {...base} phase="failed" detail="gone" onRetry={onRetry} />);
    expect(screen.queryByTestId("input-title")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("ResourceDetail", () => {
  test("every field in schema order, and delete only for a caller who may", async () => {
    const row = { id: "1", title: "Buy milk", status: "open", rank: 2, pinned: true, tags: ["a"] };
    const onDelete = jest.fn();
    await inTheme(
      <ResourceDetail entry={note} row={row} error="" onRetry={none} onDelete={onDelete} />,
    );
    expect(screen.getByLabelText("Title, Buy milk")).toBeOnTheScreen();
    expect(screen.getByLabelText("Pinned, Yes")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Delete note" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    await screen.unmount();
    await inTheme(<ResourceDetail entry={note} row={row} error="" onRetry={none} />);
    expect(screen.queryByRole("button", { name: "Delete note" })).toBeNull();
  });
});

describe("Actions", () => {
  const row = { id: "1", title: "Buy milk", status: "open", rank: 2, pinned: true, tags: [] };
  const detail = { entry: note, row, error: "", onRetry: none };
  const commands = note.commands.filter((c) => !c.collection);

  test("a command is a row in the API document's own words, and it runs once", async () => {
    const onRun = jest.fn();
    await inTheme(<ResourceDetail {...detail} actions={{ commands, running: "", onRun }} />);
    await fireEvent.press(screen.getByRole("button", { name: "Publish a note" }));
    expect(onRun).toHaveBeenCalledWith(commands[0]);
    expect(screen.getByText(/Makes the note visible/)).toBeOnTheScreen();
  });

  test("a command about the collection is under the list, not on a row", async () => {
    const onRun = jest.fn();
    const archive = note.commands.filter((c) => c.collection);
    await inTheme(
      <ResourceList
        {...{
          entry: note,
          rows: [],
          total: 0,
          loading: false,
          refreshing: false,
          more: false,
          error: "",
          order: noOrder,
          ordering: false,
          onOrder: none,
          onMore: none,
          onRefresh: none,
          onOpen: none,
        }}
        actions={{ commands: archive, running: "", onRun }}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Archive every resolved note" }));
    expect(onRun).toHaveBeenCalledWith(archive[0]);
  });

  test("a command under way cannot be run again, and a record with none shows no section", async () => {
    const onRun = jest.fn();
    await inTheme(<ResourceDetail {...detail} actions={{ commands, running: "publish", onRun }} />);
    await fireEvent.press(screen.getByRole("button", { name: "Publish a note" }));
    expect(onRun).not.toHaveBeenCalled();
    await screen.unmount();
    await inTheme(<ResourceDetail {...detail} actions={{ commands: [], running: "", onRun }} />);
    expect(screen.queryByText("Actions")).toBeNull();
  });
});

describe("Activity", () => {
  const now = new Date("2026-09-07T12:00:00Z");
  const trail = {
    events: [
      {
        id: "e1",
        name: "note.note.updated",
        occurredAt: "2026-09-07T11:58:00Z",
        actor: "u1",
        payload: { id: "1" },
      },
      {
        id: "e2",
        name: "note.note.created",
        occurredAt: "2026-09-06T09:00:00Z",
        payload: { id: "1" },
      },
    ],
    names: { u1: "Joao" },
    loading: false,
    error: "",
    more: false,
    loadingMore: false,
    loadMore: none,
    now,
  };
  const row = { id: "1", title: "Buy milk", status: "open", rank: 2, pinned: true, tags: [] };
  const detail = { entry: note, row, error: "", onRetry: none };

  test("the trail says what happened, who did it and how long ago", async () => {
    await inTheme(<ResourceDetail {...detail} activity={trail} />);
    expect(screen.getByLabelText("Updated by Joao, 2 minutes ago")).toBeOnTheScreen();
    // An event nobody signed is the system's, not a blank line.
    expect(screen.getByLabelText("Created by the system, yesterday")).toBeOnTheScreen();
  });

  test("a trail with older lines offers to read them, once", async () => {
    const loadMore = jest.fn();
    await inTheme(<ResourceDetail {...detail} activity={{ ...trail, more: true, loadMore }} />);
    await fireEvent.press(screen.getByRole("button", { name: "Show older" }));
    expect(loadMore).toHaveBeenCalledTimes(1);
    await screen.unmount();
    // While the older lines come there is no second press to make.
    await inTheme(
      <ResourceDetail {...detail} activity={{ ...trail, more: true, loadingMore: true }} />,
    );
    expect(screen.queryByRole("button", { name: "Show older" })).toBeNull();
    await screen.unmount();
    await inTheme(<ResourceDetail {...detail} activity={trail} />);
    expect(screen.queryByRole("button", { name: "Show older" })).toBeNull();
  });

  test("a record with no trail yet says so, and an unreadable one says why", async () => {
    await inTheme(<ResourceDetail {...detail} activity={{ ...trail, events: [] }} />);
    expect(screen.getByText("Nothing has happened to this record yet.")).toBeOnTheScreen();
    await screen.unmount();
    await inTheme(
      <ResourceDetail {...detail} activity={{ ...trail, events: [], error: "not allowed" }} />,
    );
    expect(screen.getByText("not allowed")).toBeOnTheScreen();
  });
});

describe("Home", () => {
  test("one row per resource, read-only ones say so", async () => {
    const onOpen = jest.fn();
    const entries = [note, { ...note, entity: "tag", writable: false }];
    await inTheme(<Home entries={entries} refreshing={false} onOpen={onOpen} onRefresh={none} />);
    await fireEvent.press(screen.getByRole("button", { name: /Tags, In note, read only/ }));
    expect(onOpen).toHaveBeenCalledWith(entries[1]);
  });
});

describe("SignInForm", () => {
  test("submits the trimmed server and email with the password as typed", async () => {
    const onSubmit = jest.fn();
    await inTheme(
      <SignInForm
        baseURL="https://acme.test "
        notice=""
        busy={false}
        error=""
        onSubmit={onSubmit}
        onClear={none}
      />,
    );
    await fireEvent.changeText(screen.getByTestId("email"), " a@acme.test ");
    await fireEvent.changeText(screen.getByTestId("password"), " pw ");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(onSubmit).toHaveBeenCalledWith("https://acme.test", "a@acme.test", " pw ");
  });

  test("an unreachable server is retried; an unreadable saved sign-in is cleared", async () => {
    const onSubmit = jest.fn();
    const onClear = jest.fn();
    await inTheme(
      <SignInForm
        baseURL=""
        notice="The saved sign-in could not be read."
        busy={false}
        error="Network request failed"
        onSubmit={onSubmit}
        onClear={onClear}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Clear saved sign-in" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe("Values by type", () => {
  const row = {
    id: "1",
    title: "Buy milk",
    status: "open",
    rank: 2,
    pinned: true,
    tags: ["a", "b"],
  };

  test("a detail shows each value in the shape its type deserves", async () => {
    await inTheme(<ResourceDetail entry={note} row={row} error="" onRetry={none} />);
    // A closed set and a yes-or-no are badges; a screen reader still hears the words.
    expect(screen.getByLabelText("Status, Open")).toBeOnTheScreen();
    expect(screen.getByLabelText("Pinned, Yes")).toBeOnTheScreen();
    // A list is its items, not a comma-joined string.
    expect(screen.getByLabelText("Tags, a, b")).toBeOnTheScreen();
    expect(screen.getByText("a")).toBeOnTheScreen();
    expect(screen.getByText("b")).toBeOnTheScreen();
  });

  test("a value a closed set does not contain is not coloured as if it were", async () => {
    await inTheme(
      <ResourceDetail
        entry={note}
        row={{ ...row, status: "unheard-of" }}
        error=""
        onRetry={none}
      />,
    );
    expect(screen.getByLabelText("Status, Unheard of")).toBeOnTheScreen();
  });
});
