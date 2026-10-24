// What this phone is holding is on the home screen, above the resources, with
// the two acts that belong to the person. A write that left the sheet and never
// reached the server is invisible unless this screen says it is here.
import { feedback } from "../fakes/presentation";
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import { heldWrite, heldWriteView } from "../../src/core/outbox";
import { Home } from "../../src/ui/organisms/Home";
import { ThemeProvider } from "../../src/ui/theme";
import { unresolved } from "../fakes/unresolved";

const catalog = parseCatalog(unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8"))));
const note = catalog.resources.find((r) => r.entity === "note")!;
const inTheme = (el: React.ReactElement) =>
  render(<ThemeProvider mode="light">{el}</ThemeProvider>);
const none = () => undefined;

describe("what Home holds", () => {
  test("what this phone is holding stands above the resources, with its two acts", async () => {
    const retry = jest.fn();
    const discard = jest.fn();
    const owed = heldWrite(
      { kind: "create", resourceKey: "note/note", path: "/api/v1/note/notes", body: { t: 1 } },
      "write-1",
      "2026-10-06T10:00:00.000Z",
    );
    await inTheme(
      <Home
        feedback={feedback}
        entries={[note]}
        refreshing={false}
        greeting="Good morning"
        workspace="acme.test"
        cards={[]}
        counts={{}}
        held={[heldWriteView(owed, feedback)]}
        onRetryHeld={retry}
        onDiscardHeld={discard}
        onOpen={none}
        onRefresh={none}
      />,
    );
    expect(screen.getByTestId("held-write-write-1")).toBeOnTheScreen();
    // The group names itself and the row says its own state, which for a write
    // that never left are the same words: the section is where a person looks,
    // the row is what they act on.
    expect(screen.getAllByText("Held on this phone")).toHaveLength(2);
    expect(screen.getByText("It will send when this phone reaches the server.")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("held-write-write-1-retry"));
    fireEvent.press(screen.getByTestId("held-write-write-1-discard"));
    expect(retry).toHaveBeenCalledWith("write-1");
    expect(discard).toHaveBeenCalledWith("write-1");
    // The list keeps measuring its rows after the test's own awaits settle, and
    // a render still working is a render the next test cannot start cleanly.
    await screen.unmount();
  });
});
