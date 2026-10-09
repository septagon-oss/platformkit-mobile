import { feedback, presentation } from "../fakes/presentation";
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import { deriveEventActivity, formControls, noOrder, sortOptions } from "../../src/core/derive";
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
  test("a failed first read offers recovery without claiming the collection is empty", async () => {
    const onRefresh = jest.fn();
    await inTheme(
      <ResourceList
        presentation={presentation}
        entry={note}
        rows={[]}
        total={0}
        loading={false}
        refreshing={false}
        more={false}
        error="Connection lost."
        order={{ sort: "", filters: {} }}
        ordering={false}
        onOrder={none}
        onOpen={none}
        onMore={none}
        onRefresh={onRefresh}
      />,
    );
    expect(screen.getByText("Connection lost.")).toBeOnTheScreen();
    expect(screen.queryByText("No notes yet")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
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
    await inTheme(<ResourceList presentation={presentation} {...props} onOpen={onOpen} />);
    // The cells are the closed set, the yes-or-no and the number, in that
    // order: not the times every record has.
    await fireEvent.press(
      screen.getByRole("button", { name: "Buy milk, Status: Open, Pinned: No, Rank: 2" }),
    );
    expect(onOpen).toHaveBeenCalledWith("1");
  });

  test("an empty list offers the first one only to a caller who may write", async () => {
    const onNew = jest.fn();
    await inTheme(
      <ResourceList
        presentation={presentation}
        {...props}
        rows={[]}
        total={0}
        onOpen={none}
        onNew={onNew}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "New note" }));
    expect(onNew).toHaveBeenCalledTimes(1);
    await screen.unmount();
    await inTheme(
      <ResourceList presentation={presentation} {...props} rows={[]} total={0} onOpen={none} />,
    );
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
  const base = {
    initialDate: new Date("2026-08-11T08:20:00Z"),
    controls,
    held: {},
    errors: {},
    detail: "",
    onChange: none,
    onRetry: none,
  };

  test("while the row loads there is nothing to type into", async () => {
    await inTheme(<ResourceForm feedback={feedback} {...base} phase="loading" />);
    expect(screen.queryByTestId("input-title")).toBeNull();
    expect(screen.getByRole("progressbar")).toBeOnTheScreen();
  });

  test("the refusal sits under the control it is about, and the general one at the top", async () => {
    await inTheme(
      <ResourceForm
        feedback={feedback}
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
    await inTheme(<ResourceForm feedback={feedback} {...base} phase="saving" />);
    expect(screen.getByTestId("input-title")).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Pinned" })).toBeDisabled();
  });

  test("a failed load offers a retry and no controls", async () => {
    const onRetry = jest.fn();
    await inTheme(
      <ResourceForm feedback={feedback} {...base} phase="failed" detail="gone" onRetry={onRetry} />,
    );
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
      <ResourceDetail
        feedback={feedback}
        entry={note}
        row={row}
        error=""
        onRetry={none}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByLabelText("Title, Buy milk")).toBeOnTheScreen();
    // A field's row is named after the field, so a journey finds it by the name
    // the API document gives it and never by the label's spelling.
    expect(screen.getByTestId("field-title")).toBeOnTheScreen();
    expect(screen.getByLabelText("Pinned, Yes")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Delete note" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    await screen.unmount();
    await inTheme(
      <ResourceDetail feedback={feedback} entry={note} row={row} error="" onRetry={none} />,
    );
    expect(screen.queryByRole("button", { name: "Delete note" })).toBeNull();
  });
});

describe("Actions", () => {
  const row = { id: "1", title: "Buy milk", status: "open", rank: 2, pinned: true, tags: [] };
  const detail = { entry: note, row, error: "", onRetry: none };
  const commands = note.commands.filter((c) => !c.collection);

  test("a command is a row in the API document's own words, and it runs once", async () => {
    const onRun = jest.fn();
    await inTheme(
      <ResourceDetail feedback={feedback} {...detail} actions={{ commands, running: "", onRun }} />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Publish a note" }));
    expect(onRun).toHaveBeenCalledWith(commands[0]);
    expect(screen.getByText(/Makes the note visible/)).toBeOnTheScreen();
  });

  test("a command about the collection is under the list, not on a row", async () => {
    const onRun = jest.fn();
    const archive = note.commands.filter((c) => c.collection);
    await inTheme(
      <ResourceList
        presentation={presentation}
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
    await inTheme(
      <ResourceDetail
        feedback={feedback}
        {...detail}
        actions={{ commands, running: "publish", onRun }}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Publish a note" }));
    expect(onRun).not.toHaveBeenCalled();
    await screen.unmount();
    await inTheme(
      <ResourceDetail
        feedback={feedback}
        {...detail}
        actions={{ commands: [], running: "", onRun }}
      />,
    );
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
    excluded: false,
    loadingMore: false,
    loadMore: none,
    now,
  };
  const adapt = (value: Omit<typeof trail, "loadMore"> & { loadMore: () => void }) => {
    const result = deriveEventActivity(value, { ...presentation, now: value.now.toISOString() });
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    return { model: result.value, onMore: value.loadMore };
  };
  const row = { id: "1", title: "Buy milk", status: "open", rank: 2, pinned: true, tags: [] };
  const detail = { entry: note, row, error: "", onRetry: none };

  test("the trail says what happened, who did it and how long ago", async () => {
    await inTheme(<ResourceDetail feedback={feedback} {...detail} activity={adapt(trail)} />);
    expect(screen.getByLabelText("Updated by Joao, Sep 7, 2026, 11:58 AM")).toBeOnTheScreen();
    // A glance reads the distance; a reader is told which instant it is the distance to.
    expect(screen.getByText("2 minutes ago")).toBeOnTheScreen();
    // An event nobody signed is the system's, not a blank line.
    expect(screen.getByLabelText("Created by the system, Sep 6, 2026, 09:00 AM")).toBeOnTheScreen();
    expect(screen.getByText("Yesterday, 09:00 AM")).toBeOnTheScreen();
  });

  test("a trail with older lines offers to read them, once", async () => {
    const loadMore = jest.fn();
    await inTheme(
      <ResourceDetail
        feedback={feedback}
        {...detail}
        activity={adapt({ ...trail, more: true, loadMore })}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Show older" }));
    expect(loadMore).toHaveBeenCalledTimes(1);
    await screen.unmount();
    // While the older lines come there is no second press to make.
    await inTheme(
      <ResourceDetail
        feedback={feedback}
        {...detail}
        activity={adapt({ ...trail, more: true, loadingMore: true })}
      />,
    );
    expect(screen.queryByRole("button", { name: "Show older" })).toBeNull();
    await screen.unmount();
    await inTheme(<ResourceDetail feedback={feedback} {...detail} activity={adapt(trail)} />);
    expect(screen.queryByRole("button", { name: "Show older" })).toBeNull();
  });

  test("a plan that does not include the trail says so, and is not an error", async () => {
    await inTheme(
      <ResourceDetail
        feedback={feedback}
        {...detail}
        activity={adapt({ ...trail, events: [], excluded: true })}
      />,
    );
    expect(screen.getByText(/plan does not include the activity trail/)).toBeOnTheScreen();
    expect(screen.queryByText("Nothing has happened to this record yet.")).toBeNull();
  });

  test("a record with no trail yet says so, and an unreadable one says why", async () => {
    await inTheme(
      <ResourceDetail feedback={feedback} {...detail} activity={adapt({ ...trail, events: [] })} />,
    );
    expect(screen.getByText("Nothing has happened to this record yet.")).toBeOnTheScreen();
    await screen.unmount();
    await inTheme(
      <ResourceDetail
        feedback={feedback}
        {...detail}
        activity={adapt({ ...trail, events: [], error: "not allowed" })}
      />,
    );
    expect(screen.getByText("not allowed")).toBeOnTheScreen();
  });
});

describe("Home", () => {
  test("the resources are one group of rows, and a read-only one says so", async () => {
    const onOpen = jest.fn();
    const entries = [note, { ...note, entity: "tag", writable: false }];
    await inTheme(
      <Home
        feedback={feedback}
        entries={entries}
        refreshing={false}
        account="joao@acme.test"
        onOpen={onOpen}
        onRefresh={none}
      />,
    );
    // One list, one group: the resources are rows of one card, not a card apiece, and
    // a row says what it is rather than which module it came in on.
    expect(screen.getAllByTestId("home")).toHaveLength(1);
    expect(screen.getByText("joao@acme.test")).toBeOnTheScreen();
    expect(screen.getByTestId("open-note-note")).toBeOnTheScreen();
    expect(screen.queryByText(/In note/)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: /Tags, Read only/ }));
    expect(onOpen).toHaveBeenCalledWith(entries[1]);
  });

  test("a signed-in screen with no account to name shows the rows alone", async () => {
    const entries = [note];
    await inTheme(
      <Home
        feedback={feedback}
        entries={entries}
        refreshing={false}
        onOpen={() => undefined}
        onRefresh={none}
      />,
    );
    expect(screen.getByTestId("open-note-note")).toBeOnTheScreen();
  });
});

describe("SignInForm", () => {
  test("submits the trimmed server and email with the password as typed", async () => {
    const onSubmit = jest.fn();
    await inTheme(
      <SignInForm
        feedback={feedback}
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

  test("the form asks for the workspace address in the person's words, not in tenancy jargon", async () => {
    await inTheme(
      <SignInForm
        feedback={feedback}
        baseURL="https://acme.test"
        notice=""
        busy={false}
        error=""
        onSubmit={none}
        onClear={none}
      />,
    );
    expect(
      screen.getByText("Enter your workspace address and the email you use there."),
    ).toBeOnTheScreen();
    expect(screen.getByText("Workspace address")).toBeOnTheScreen();
    // The input itself says what it holds, and keeps the id the sign-in flow types into.
    expect(screen.getByTestId("server").props.accessibilityLabel).toBe("Workspace address");
    expect(screen.queryByText(/tenant/i)).toBeNull();
  });

  test('the product\'s name stands over the form, and "Sign in" when it has none to say', async () => {
    const base = { baseURL: "", notice: "", busy: false, error: "", onSubmit: none, onClear: none };
    await inTheme(<SignInForm feedback={feedback} {...base} />);
    // The word is the heading and the button; nothing else says it.
    expect(screen.getAllByText("Sign in")).toHaveLength(2);
    await screen.unmount();
    await inTheme(<SignInForm feedback={feedback} {...base} title="Collect" />);
    expect(screen.getByText("Collect")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeOnTheScreen();
  });

  test("while a saved sign-in is restored the form waits behind a spinner", async () => {
    await inTheme(
      <SignInForm
        feedback={feedback}
        baseURL=""
        notice=""
        busy={false}
        error=""
        onSubmit={none}
        onClear={none}
        title="Collect"
        booting
      />,
    );
    expect(screen.getByTestId("sign-in-booting")).toBeOnTheScreen();
    expect(screen.getByText("Collect")).toBeOnTheScreen();
    expect(screen.getByText("Restoring your saved sign-in…")).toBeOnTheScreen();
    expect(screen.getByLabelText("Loading")).toBeOnTheScreen();
    expect(screen.queryByTestId("submit")).toBeNull();
  });

  test("a saved sign-in that could not be opened is retried, or replaced by another server's", async () => {
    const onRetry = jest.fn();
    const onClear = jest.fn();
    await inTheme(
      <SignInForm
        feedback={feedback}
        baseURL="https://acme.test"
        notice=""
        busy={false}
        error=""
        onSubmit={none}
        onClear={onClear}
        failed="https://acme.test did not answer within 15 seconds."
        onRetry={onRetry}
      />,
    );
    expect(screen.getByTestId("sign-in-failed")).toBeOnTheScreen();
    expect(screen.getByRole("alert")).toHaveTextContent(/did not answer/);
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in to another server" }));
    expect(onClear).toHaveBeenCalledTimes(1);
    // There is no form to fill until the saved sign-in is retried or cleared.
    expect(screen.queryByTestId("email")).toBeNull();
  });

  test("an unreachable server is retried; an unreadable saved sign-in is cleared", async () => {
    const onSubmit = jest.fn();
    const onClear = jest.fn();
    await inTheme(
      <SignInForm
        feedback={feedback}
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
    await inTheme(
      <ResourceDetail feedback={feedback} entry={note} row={row} error="" onRetry={none} />,
    );
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
        feedback={feedback}
        entry={note}
        row={{ ...row, status: "unheard-of" }}
        error=""
        onRetry={none}
      />,
    );
    expect(screen.getByLabelText("Status, Unheard of")).toBeOnTheScreen();
  });
});
