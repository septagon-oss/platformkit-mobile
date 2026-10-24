// Home's "Recently opened" is a list of the phone's own: it is drawn from what this device
// remembers this person opening, in the order they opened them, and it leads to the record
// itself. A phone that keeps no list, and a person who has opened nothing, both draw no
// section — an empty section would be a claim about a device rather than a fact about a day.
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import { greeting, type Presentation } from "../../src/core/derive";
import type { Recent, RecentDoor } from "../../src/core/recents";
import { Home } from "../../src/ui/organisms/Home";
import { ThemeProvider } from "../../src/ui/theme";
import { feedback } from "../fakes/presentation";
import { unresolved } from "../fakes/unresolved";

const catalog = parseCatalog(unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8"))));
const note = catalog.resources.find((r) => r.entity === "note")!;
const presentation: Presentation = { ...feedback, weekStartsOn: 1 };
const hello = greeting({ name: "Ana Rita" }, presentation);
const none = () => undefined;
const drawn = (text: string) =>
  expect(screen.getAllByText(text, { hidden: true })).not.toHaveLength(0);

const remembered = (id: string, title: string, at: string): Recent => ({
  resourceKey: "note/note",
  recordId: id,
  title,
  openedAt: at,
});

const standup = remembered("n-1", "Standup notes", "2026-10-06T10:00:00.000Z");
const retro = remembered("n-2", "Retro, third quarter", "2026-10-06T09:00:00.000Z");

/** page is Home as the screen draws it. `recents` is left out entirely to be a device with no store. */
async function page(over: Partial<React.ComponentProps<typeof Home>> = {}) {
  const given: React.ComponentProps<typeof Home> = {
    feedback,
    entries: [note],
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
  };
  return render(
    <ThemeProvider mode="light">
      <Home {...given} {...over} />
    </ThemeProvider>,
  );
}

describe("Home remembers what was opened", () => {
  test("the section names itself and holds one row per record, newest first", async () => {
    const opened: RecentDoor[] = [
      { recent: standup, entry: note },
      { recent: retro, entry: note },
    ];
    await page({ recents: opened, onOpenRecent: none });
    expect(screen.getByTestId("home-section-recent")).toBeOnTheScreen();
    drawn(feedback.copy.kit.recentlyOpened);
    expect(screen.getByTestId("home-recent-note-note-n-1")).toBeOnTheScreen();
    expect(screen.getByTestId("home-recent-note-note-n-2")).toBeOnTheScreen();
    // The words the record screen drew are the row's title — not the id, not the resource.
    drawn("Standup notes");
    drawn("Retro, third quarter");
  });

  test("a row opens the record it remembers, and only that one", async () => {
    const opened: RecentDoor[] = [
      { recent: standup, entry: note },
      { recent: retro, entry: note },
    ];
    const onOpenRecent = jest.fn();
    await page({ recents: opened, onOpenRecent });
    fireEvent.press(screen.getByTestId("home-recent-note-note-n-2"));
    expect(onOpenRecent).toHaveBeenCalledTimes(1);
    expect(onOpenRecent).toHaveBeenCalledWith({ recent: retro, entry: note });
  });

  test("a device that keeps no list draws no section", async () => {
    await page({ onOpenRecent: none });
    expect(screen.queryByTestId("home-section-recent")).toBeNull();
    // The greeting, the resources and the account are undisturbed by the absence.
    drawn(hello.line);
    expect(screen.getByTestId("open-note-note")).toBeOnTheScreen();
  });

  test("a person who has opened nothing draws no section either", async () => {
    await page({ recents: [], onOpenRecent: none });
    expect(screen.queryByTestId("home-section-recent")).toBeNull();
    expect(screen.getByTestId("open-note-note")).toBeOnTheScreen();
  });

  test("the rows this person may reach are still named as one section", async () => {
    await page({ recents: [{ recent: standup, entry: note }], onOpenRecent: none });
    expect(screen.getByTestId("home-section-resources")).toBeOnTheScreen();
    drawn(feedback.copy.kit.allResources);
  });
});
