// Home's first minute: the person is greeted, the workspace is named, and the counts
// the installation answered stand under them. A number the server never answered must
// not appear as a zero, and a count that went out of date must go away.
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import { deriveCopy, deriveFeedback, greeting, type Presentation } from "../../src/core/derive";
import { rowCounts, statCards } from "../../src/core/summary";
import { Home } from "../../src/ui/organisms/Home";
import { ThemeProvider } from "../../src/ui/theme";
import { feedback } from "../fakes/presentation";
import { unresolved } from "../fakes/unresolved";

const catalog = parseCatalog(unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8"))));
const note = catalog.resources.find((r) => r.entity === "note")!;
const inTheme = (el: React.ReactElement) =>
  render(<ThemeProvider mode="light">{el}</ThemeProvider>);
const none = () => undefined;
/** drawn is what the page paints, whether or not a reader stops on it: a card is one stop, so the tiles inside it are a11y leaves. */
const drawn = (text: string) =>
  expect(screen.getAllByText(text, { hidden: true })).not.toHaveLength(0);

const presentation: Presentation = { ...feedback, weekStartsOn: 1 };
const named = { ...note, hints: { ...note.hints, highlight: { label: "Due today" } } };
const body = (entries: readonly Record<string, unknown>[]) =>
  ({ asOf: "2026-07-18T09:00:00Z", entries }) as never;
const cardsFor = (entries: readonly Record<string, unknown>[], entry = named) =>
  statCards(body(entries), [entry], presentation);
const countsFor = (entries: readonly Record<string, unknown>[], entry = named) =>
  rowCounts(body(entries), [entry], presentation);
const hello = greeting({ name: "Ana Rita" }, presentation);

const screenWith = (
  over: Partial<React.ComponentProps<typeof Home>> = {},
  given: React.ComponentProps<typeof Home> = {
    feedback,
    entries: [named],
    refreshing: false,
    greeting: hello.line,
    workspace: "acme.test",
    cards: [],
    counts: {},
    held: [],
    onRetryHeld: none,
    onDiscardHeld: none,
    onOpen: none,
    onRefresh: none,
  },
) =>
  inTheme(
    <Home
      {...given}
      {...Object.fromEntries(Object.entries(over).filter(([, v]) => v !== undefined))}
    />,
  );

describe("Home greets the person", () => {
  test("the greeting and the workspace name open the page, above the rows", async () => {
    await screenWith();
    expect(screen.getByTestId("home-greeting")).toBeOnTheScreen();
    expect(screen.getByText("Good morning, Ana")).toBeOnTheScreen();
    expect(screen.getByTestId("home-workspace")).toHaveTextContent("acme.test");
    expect(screen.getByText("All resources")).toBeOnTheScreen();
    expect(screen.getByTestId("open-note-note")).toBeOnTheScreen();
    await screen.unmount();
  });

  test("a card says its number, its word and the sub-count the catalogue named", async () => {
    const open = jest.fn();
    const cards = cardsFor([
      {
        module: "note",
        entity: "note",
        total: 128,
        highlight: 4,
        trend: {
          field: "createdAt",
          days: [0, 1, 0, 3, 2, 0, 1, 4, 0, 0, 2, 1, 0, 5].map((count, i) => ({
            day: `2026-07-${String(i + 1).padStart(2, "0")}`,
            count,
          })),
        },
      },
    ]);
    await screenWith({ cards, onOpen: open });
    const card = screen.getByTestId("home-stat-note-note");
    expect(card).toBeOnTheScreen();
    drawn("128");
    drawn("Notes");
    drawn("Due today · 4");
    // One stop, one sentence: the card is labelled with the whole thing and the shape
    // under the number is decoration, so a reader is not handed fourteen point pairs.
    expect(screen.getByRole("button", { name: "Notes: 128. Due today · 4." })).toBeOnTheScreen();
    await fireEvent.press(card);
    expect(open).toHaveBeenCalledWith(named);
    await screen.unmount();
  });

  test("the row carries the same count the card leads with", async () => {
    await screenWith({ counts: countsFor([{ module: "note", entity: "note", total: 128 }]) });
    expect(screen.getByTestId("home-count-note-note")).toHaveTextContent("128");
    await screen.unmount();
  });

  test("a count nobody answered draws no card, no number and no zero", async () => {
    await screenWith({ cards: cardsFor([{ module: "note", entity: "note" }]) });
    expect(screen.queryAllByTestId(/home-stat-/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/home-count-/)).toHaveLength(0);
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByTestId("open-note-note")).toBeOnTheScreen();
    await screen.unmount();
  });

  test("a refresh that refuses takes the cards that were drawn away", async () => {
    const given = {
      feedback,
      entries: [named],
      refreshing: false,
      greeting: hello.line,
      workspace: "acme.test",
      cards: cardsFor([{ module: "note", entity: "note", total: 128, highlight: 4 }]),
      counts: countsFor([{ module: "note", entity: "note", total: 128 }]),
      held: [],
      onRetryHeld: none,
      onDiscardHeld: none,
      onOpen: none,
      onRefresh: none,
    } satisfies React.ComponentProps<typeof Home>;
    await screenWith({}, given);
    expect(screen.getByTestId("home-stat-note-note")).toBeOnTheScreen();
    // The same screen, the second read refused: the cards are counts, and a count with
    // no stated age is a claim about now. The rows and the greeting were never the
    // failed read's to take.
    await screenWith({ cards: [], counts: {} }, given);
    expect(screen.queryAllByTestId(/home-stat-/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/home-count-/)).toHaveLength(0);
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByText("Good morning, Ana")).toBeOnTheScreen();
    expect(screen.getByTestId("open-note-note")).toBeOnTheScreen();
    await screen.unmount();
  });

  test("the same page draws with motion allowed", async () => {
    const moving = deriveFeedback(deriveCopy("en"), "normal", feedback);
    await screenWith({
      feedback: moving,
      cards: cardsFor([{ module: "note", entity: "note", total: 12 }]),
      counts: countsFor([{ module: "note", entity: "note", total: 12 }]),
    });
    expect(screen.getByText("Good morning, Ana")).toBeOnTheScreen();
    expect(screen.getByTestId("home-stat-note-note")).toBeOnTheScreen();
    drawn("12");
    expect(screen.getByTestId("home-count-note-note")).toHaveTextContent("12");
    await screen.unmount();
  });
});
