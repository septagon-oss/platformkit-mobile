// Home's stat cards stand side by side in the page's one column. Whatever the cards are
// laid out in must hold every card it draws at the width the design floor measures a
// phone at: a card that runs past the screen's edge is a card the person cannot read.
// The layout engine does not run under Jest, so the row is measured from the styles the
// organism really renders: a row that wraps, scrolls sideways or stacks holds any number
// of cards; a row that does none of those must fit their minimum widths and its gaps.
import { describe, expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import type { Presentation } from "../../src/core/derive";
import { cardLimit, statCards } from "../../src/core/summary";
import { Home } from "../../src/ui/organisms/Home";
import { space } from "../../src/ui/scale";
import { ThemeProvider } from "../../src/ui/theme";
import { feedback } from "../fakes/presentation";

const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
const presentation: Presentation = { ...feedback, weekStartsOn: 1 };
const none = () => undefined;

/** phone is the narrow width the design floor measures a page at. */
const phone = 390;
/** column is what the page's canvas leaves of it: `canvas.content` insets both sides by `space.lg`. */
const column = phone - 2 * space.lg;

interface Node {
  readonly type: unknown;
  readonly props: Record<string, unknown>;
  readonly parent: Node | null;
}

/** host is the nearest ancestor React Native draws itself, the box a layout engine places. */
function host(from: Node): Node {
  let at = from.parent;
  while (at && typeof at.type !== "string") at = at.parent;
  if (!at) throw new Error("a card with no drawn container");
  return at;
}

const styleOf = (node: Node): ViewStyle =>
  (StyleSheet.flatten(node.props.style as ViewStyle) ?? {}) as ViewStyle;

describe("Home's stat cards", () => {
  test("every card Home draws fits the phone column it is drawn in", async () => {
    const entries = catalog.resources;
    const cards = statCards(
      {
        asOf: "2026-07-18T09:00:00Z",
        entries: entries.map((e, i) => ({ module: e.module, entity: e.entity, total: 10 + i })),
      } as never,
      entries,
      presentation,
    );
    // The fixture answers a count for as many resources as Home shows cards for, so the
    // row holds the most cards it can ever hold.
    expect(cards).toHaveLength(cardLimit);
    await render(
      <ThemeProvider mode="light">
        <Home
          feedback={feedback}
          entries={entries}
          refreshing={false}
          greeting="Good morning, Ana"
          workspace="acme.test"
          cards={cards}
          counts={{}}
          held={[]}
          onRetryHeld={none}
          onDiscardHeld={none}
          onOpen={none}
          onRefresh={none}
        />
      </ThemeProvider>,
    );
    const drawn = screen.getAllByTestId(/^home-stat-/) as unknown as Node[];
    expect(drawn).toHaveLength(cardLimit);
    const row = host(drawn[0]!);
    for (const card of drawn) expect(host(card)).toBe(row);
    const laid = styleOf(row);
    const holdsAny =
      row.props.horizontal === true || laid.flexWrap === "wrap" || laid.flexDirection !== "row";
    const gap = Number(laid.columnGap ?? laid.gap ?? 0);
    const needs =
      drawn.reduce((sum, card) => sum + Number(styleOf(card).minWidth ?? 0), 0) +
      gap * (drawn.length - 1);
    expect({ holdsAny, fits: holdsAny || needs <= column, needs, column }).toEqual({
      holdsAny,
      fits: true,
      needs,
      column,
    });
    await screen.unmount();
  });
});
