// A deck whose read is withdrawn (no access, gone, signed out, off the plan) shows none of the rows
// it held and takes no further input: no choice, page, answer, refresh, retry or resume reopens it,
// whether the read failed while the pass was loading or while it was checking for more.
import assert from "node:assert/strict";
import test from "node:test";
import { deckEvent, reviewDeck, startDeck, type DeckInput, type DeckState } from "../src/core/deck";
import { deckEntryFixture, deckRows } from "./fakes/deck";

const deck = reviewDeck(deckEntryFixture())!;
function event(s: DeckState, input: DeckInput): DeckState {
  return deckEvent(s, { ...input, session: s.session });
}
function withdraw(s: DeckState): DeckState {
  return event(s, {
    type: "read-failed",
    operation: s.operation,
    text: "Signed out",
    retryable: true,
    withdraw: true,
  });
}

test("a deck whose read is withdrawn holds none of its rows and ignores every later input", () => {
  let shown = startDeck(deck);
  shown = event(shown, {
    type: "page",
    operation: shown.operation,
    offset: 0,
    items: deckRows,
    total: deckRows.length,
  });
  assert.equal(shown.phase, "ready");
  shown = event(shown, { type: "choose", direction: "right", confirmation: false });
  shown = event(shown, { type: "accepted", operation: shown.operation });
  shown = event(shown, { type: "settled", operation: shown.operation });
  assert.equal(shown.history.length, 1);

  const loading = event(shown, { type: "refresh" });
  assert.equal(loading.phase, "loading");
  let checking = shown;
  for (let i = 0; i < shown.active.length; i++) {
    checking = event(checking, { type: "choose", direction: "down", confirmation: false });
    checking = event(checking, { type: "settled", operation: checking.operation });
  }
  assert.equal(checking.phase, "checking");

  for (const before of [loading, checking]) {
    const s = withdraw(before);
    assert.equal(s.phase, "withdrawn", before.phase);
    assert.equal(s.notice, "Signed out");
    assert.equal(s.retryable, false);
    assert.equal(s.session, before.session + 1);
    assert.deepEqual(s.rows, {});
    assert.deepEqual(s.active, []);
    assert.deepEqual(s.history, []);
    assert.deepEqual(s.deferred, []);
    assert.equal(s.pending, undefined);

    const late: DeckInput[] = [
      { type: "refresh" },
      { type: "retry" },
      { type: "resume" },
      { type: "suspend" },
      { type: "rewind" },
      { type: "existing", heldID: "stored", unknown: false, text: "Held" },
      ...["left", "down", "right"].map((direction) => ({
        type: "choose" as const,
        direction,
        confirmation: false,
      })),
    ];
    for (const operation of [s.operation, before.operation]) {
      late.push(
        { type: "page", operation, offset: 0, items: deckRows, total: deckRows.length },
        { type: "count", operation, total: 0 },
        { type: "confirm", operation },
        { type: "accepted", operation },
        { type: "settled", operation },
      );
    }
    for (const input of late) assert.equal(event(s, input), s, `${before.phase}: ${input.type}`);
    for (const input of late)
      assert.equal(deckEvent(s, { ...input, session: before.session }), s, input.type);
  }
});
