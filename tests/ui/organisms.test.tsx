import { feedback, presentation } from "../fakes/presentation";
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import {
  deriveDisclosure,
  deriveEventActivity,
  formSections,
  noOrder,
  sortOptions,
} from "../../src/core/derive";
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
    onOrder: none,
    onMore: none,
    onRefresh: none,
  };

  test("a row is its name and what tells it apart, and opens by id", async () => {
    const onOpen = jest.fn();
    await inTheme(<ResourceList presentation={presentation} {...props} onOpen={onOpen} />);
    // The cells are the closed set and the yes-or-no: two values, in that order,
    // which is what one line of a phone holds. The number ranks behind them and
    // the times every record has are never cells at all.
    await fireEvent.press(
      screen.getByRole("button", { name: "Buy milk, Status: Open, Pinned: No" }),
    );
    expect(screen.queryByText(/Rank/)).toBeNull();
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

  test("the state a row wears as its pill is not said again beside its name", async () => {
    // The hinted note declares `status` as its state and points its summary at that
    // same field. One value, one drawing: the pill in the column `Row` reserves for it,
    // and no cell repeating it under the field's own word. Two identical badges on one
    // row is what this refuses, so it counts what is drawn rather than the model.
    const hinted = parseCatalog(JSON.parse(readFileSync("testdata/catalog.hints.json", "utf8")))
      .resources[0]!;
    await inTheme(
      <ResourceList
        presentation={presentation}
        {...props}
        entry={hinted}
        rows={[{ id: "1", title: "Buy milk", status: "open", pinned: false }]}
        onOpen={none}
      />,
    );
    expect(screen.getAllByText("Em aberto")).toHaveLength(1);
    expect(screen.queryByText("State")).toBeNull();
    await screen.unmount();
    // An entry that declares no state has no pill to defer to, and the same value is
    // then the row's own cell — the rule holds from both sides of the declaration.
    await inTheme(<ResourceList presentation={presentation} {...props} onOpen={none} />);
    expect(
      screen.getByRole("button", { name: "Buy milk, Status: Open, Pinned: No" }),
    ).toBeOnTheScreen();
  });

  test("the orders offered are newest, oldest and the field the list leads with, both ways", () => {
    const labels = sortOptions(note, presentation).map((o) => o.label);
    expect(labels).toEqual(["Newest first", "Oldest first", "Title, A–Z", "Title, Z–A"]);
  });
});

describe("ResourceForm", () => {
  const blocks = formSections(note, undefined, true, feedback.copy.kit.overview);
  const base = {
    initialDate: new Date("2026-08-11T08:20:00Z"),
    blocks,
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
    expect(screen.getByRole("switch", { name: "Pinned, Optional" })).toBeDisabled();
  });

  test("each control announces whether a person may leave it, in the sheet's own words", async () => {
    await inTheme(<ResourceForm feedback={feedback} {...base} phase="editing" />);
    // The words are the copy table's, and they ride the control the eye is on —
    // `* ` is not a word, and a switch that says only "Pinned" says nothing about
    // whether leaving it is allowed.
    expect(screen.getByTestId("input-title").props.accessibilityLabel).toBe("Title, Required");
    expect(screen.getByRole("switch", { name: "Pinned, Optional" })).toBeOnTheScreen();
    expect(screen.getAllByText(/\(Optional\)/).length).toBeGreaterThan(3);
  });

  test("every control is named once, above the control, whatever the control is", async () => {
    await inTheme(<ResourceForm feedback={feedback} {...base} phase="editing" />);
    // A sheet that named a switch on its own row and a text box above its box would
    // say the same fact in two places and line nothing up. One name, drawn once by
    // FormField, for the atom that announces it and the control underneath it.
    for (const name of ["Title", "Body", "Rank", "Pinned", "Tags"])
      expect(screen.getAllByText(new RegExp(`^${name}( \\(Optional\\))?$`))).toHaveLength(1);
    expect(screen.getByRole("switch", { name: "Pinned, Optional" })).toBeOnTheScreen();
    expect(screen.getByTestId("field-pinned")).toBeOnTheScreen();
  });

  test("a field that refuses what it holds says so to the sheet, by name", async () => {
    const refused = jest.fn();
    await inTheme(
      <ResourceForm
        feedback={feedback}
        {...base}
        phase="editing"
        blocks={formSections(note, undefined, true, feedback.copy.kit.overview)}
        onFieldRefused={refused}
      />,
    );
    await fireEvent.changeText(screen.getByTestId("tags-tags"), "work, home");
    expect(refused).toHaveBeenCalledWith("tags", true);
    await fireEvent.changeText(screen.getByTestId("tags-tags"), "work home");
    expect(refused).toHaveBeenLastCalledWith("tags", false);
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
  const row = { id: "1", title: "Buy milk", status: "open", rank: 2, pinned: true, tags: ["a"] };

  /**
   * informationModel is the Record information disclosure as the screen hands it
   * over, open or closed: the open state is the screen's, the organism draws it.
   */
  const informationModel = (expanded: boolean) => {
    const model = deriveDisclosure(
      {
        id: "record-information",
        title: feedback.copy.kit.recordInformation,
        summary: feedback.copy.kit.recordInformationHolds,
        reveals: feedback.copy.kit.recordInformationContent,
        expanded,
        depth: 1,
        enabled: true,
      },
      presentation,
    );
    if (!model.ok) throw new Error(JSON.stringify(model.issues));
    return model.value;
  };

  test("the record opens on what it holds, and keeps its own history to itself", async () => {
    await inTheme(
      <ResourceDetail
        feedback={feedback}
        entry={note}
        row={row}
        error=""
        onRetry={none}
        information={{ model: informationModel(false), onExpanded: none }}
      />,
    );
    // The fields with values are drawn, named after the field they came from, so a
    // journey finds a row by the name the API document gives it.
    expect(screen.getByLabelText("Status, Open")).toBeOnTheScreen();
    expect(screen.getByLabelText("Pinned, Yes")).toBeOnTheScreen();
    // The record is *called* Buy milk; that is the header's fact, and repeating it as
    // a field would say there are two. An un-hinted entry declares no status, so the
    // record draws no pill rather than guessing one from the first enum.
    expect(screen.queryByLabelText(/Buy milk/)).toBeNull();
    // And the identifier, the stamps and the rest of the plumbing wait collapsed at
    // the foot of the screen: the person who wants them asks for them.
    expect(screen.queryByTestId("field-id")).toBeNull();
    expect(screen.getByRole("button", { name: "Show the identifier and the timestamps" }));
    await screen.unmount();

    const onExpanded = jest.fn();
    await inTheme(
      <ResourceDetail
        feedback={feedback}
        entry={note}
        row={row}
        error=""
        onRetry={none}
        information={{ model: informationModel(false), onExpanded }}
      />,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Show the identifier and the timestamps" }),
    );
    expect(onExpanded).toHaveBeenCalledWith(true);
    await screen.unmount();

    await inTheme(
      <ResourceDetail
        feedback={feedback}
        entry={note}
        row={row}
        error=""
        onRetry={none}
        information={{ model: informationModel(true), onExpanded: none }}
      />,
    );
    expect(screen.getByTestId("field-id")).toBeOnTheScreen();
    // And only what the row answers: this one carries no `updatedAt`, so no "Updated
    // at" row is drawn to be a dash.
    expect(screen.queryByTestId("field-updatedAt")).toBeNull();
    await screen.unmount();
  });

  test("the destructive row lives in the menu, and the menu only for a caller who may", async () => {
    const onDelete = jest.fn();
    // The door is there, but the `…` has not been pressed: nothing destructive sits
    // on the screen waiting to be missed.
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
    expect(screen.queryByRole("button", { name: "Delete note" })).toBeNull();
    await screen.unmount();
    await inTheme(
      <ResourceDetail
        feedback={feedback}
        entry={note}
        row={row}
        error=""
        onRetry={none}
        onDelete={onDelete}
        menuOpen
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Delete note" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    await screen.unmount();
    // No DELETE on the resource, no row whatever the menu does.
    await inTheme(
      <ResourceDetail
        feedback={feedback}
        entry={note}
        row={row}
        error=""
        onRetry={none}
        menuOpen
      />,
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
    // The row is titled and tapped; the developer's sentence about idempotence is
    // nothing a person choosing an action needs (0085).
    expect(screen.queryByText(/Makes the note visible/)).toBeNull();
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

  test("a plan that does not include the trail draws no section at all", async () => {
    await inTheme(
      <ResourceDetail
        feedback={feedback}
        {...detail}
        activity={adapt({ ...trail, events: [], excluded: true })}
      />,
    );
    // Not the plan's notice as the record's content, and not the empty state's lie
    // either: the section is simply not there.
    expect(screen.queryByText(/plan does not include the activity trail/)).toBeNull();
    expect(screen.queryByText("Activity")).toBeNull();
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
