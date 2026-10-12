// A write this phone is holding is shown as what it is: not saved, not lost, and
// with the two acts that belong to the person. The sentence comes from
// src/core/outbox.ts's own projection, so the row cannot restate the rule.
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { heldWrite, heldWriteView } from "../../src/core/outbox";
import { HeldWriteRow } from "../../src/ui/molecules/HeldWriteRow";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";
import { heldRow } from "../fakes/store";

const inTheme = (el: React.ReactElement) =>
  render(<ThemeProvider mode="light">{el}</ThemeProvider>);

describe("HeldWriteRow", () => {
  test("a write the server refused says so in the server's own words", async () => {
    const item = heldRow(
      heldWrite(
        {
          kind: "create",
          resourceKey: "note/note",
          path: "/api/v1/note/notes",
          body: { title: "" },
        },
        "write-1",
        "2026-10-06T10:00:00.000Z",
      ),
      { state: "refused", refusal: { status: 400, detail: "title is required", fields: {} } },
    );
    await inTheme(
      <HeldWriteRow
        view={heldWriteView(item, presentation)}
        onRetry={jest.fn()}
        onDiscard={jest.fn()}
      />,
    );
    expect(screen.getByText("Not sent")).toBeOnTheScreen();
    expect(screen.getByText("title is required")).toBeOnTheScreen();
    expect(screen.getByTestId("held-write-write-1-retry")).toBeOnTheScreen();
    expect(screen.getByTestId("held-write-write-1-discard")).toBeOnTheScreen();
  });

  test("Retry and Discard name the one write they are about", async () => {
    const item = heldRow(
      heldWrite(
        { kind: "delete", resourceKey: "note/note", path: "/api/v1/note/notes/7" },
        "write-2",
        "2026-10-06T10:00:00.000Z",
      ),
    );
    const retry = jest.fn();
    const discard = jest.fn();
    await inTheme(
      <HeldWriteRow view={heldWriteView(item, presentation)} onRetry={retry} onDiscard={discard} />,
    );
    expect(screen.getByText("Held on this phone")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("held-write-write-2-retry"));
    fireEvent.press(screen.getByTestId("held-write-write-2-discard"));
    expect(retry).toHaveBeenCalledWith("write-2");
    expect(discard).toHaveBeenCalledWith("write-2");
  });

  test("a write on its way is not offered again", () => {
    const item = heldRow(
      heldWrite(
        {
          kind: "create",
          resourceKey: "note/note",
          path: "/api/v1/note/notes",
          body: { title: "a" },
        },
        "write-3",
        "2026-10-06T10:00:00.000Z",
      ),
      { state: "sending", attempt: 1 },
    );
    // The projection says what the row obeys: sending is busy, so the row draws
    // no second offer of a write that is already on its way.
    expect(heldWriteView(item, presentation).busy).toBe(true);
    expect(
      heldWriteView(
        heldRow(
          heldWrite(
            {
              kind: "create",
              resourceKey: "note/note",
              path: "/api/v1/note/notes",
              body: { title: "a" },
            },
            "write-4",
            "2026-10-06T10:00:00.000Z",
          ),
          { state: "refused", refusal: { status: 403, detail: "you may not", fields: {} } },
        ),
        presentation,
      ).busy,
    ).toBe(false);
  });
});
