// A final count nothing answered ends the pass with a retry and nothing more: the choices made stay
// in the history, the finishing moment is neither played nor spent, and the deck makes no "caught up"
// claim. Only a retried count that finds the queue empty plays the finish, once; a retried count that
// still finds rows ends the pass with no retry left to offer; and a count for the failed operation
// that lands after the retry changes nothing.
import assert from "node:assert/strict";
import test from "node:test";
import { deckEvent, reviewDeck, startDeck, type DeckInput, type DeckState } from "../src/core/deck";
import { deriveDeck } from "../src/core/derive";
import { presentation } from "./fakes/presentation";
import { deckEntryFixture, deckRows } from "./fakes/deck";

const entry = deckEntryFixture();
const deck = reviewDeck(entry)!;
const words = presentation.copy.review;
function event(s: DeckState, input: DeckInput): DeckState {
  return deckEvent(s, { ...input, session: s.session });
}
const unanswered = (s: DeckState, retryable = true): DeckState =>
  event(s, {
    type: "read-failed",
    operation: s.operation,
    text: words.checkFailed,
    retryable,
    withdraw: false,
  });

/** counting decides every card (one command, two skips) and stops at the final count. */
function counting(): DeckState {
  let s = startDeck(deck);
  s = event(s, {
    type: "page",
    operation: s.operation,
    offset: 0,
    items: deckRows,
    total: deckRows.length,
  });
  for (const direction of ["right", "down", "down"]) {
    s = event(s, { type: "choose", direction, confirmation: false });
    if (s.phase === "submitting") s = event(s, { type: "accepted", operation: s.operation });
    s = event(s, { type: "settled", operation: s.operation });
  }
  assert.equal(s.phase, "checking");
  return s;
}

test("a final count nothing answered offers retry and keeps the finish for a retried count that finds none", () => {
  const before = counting();
  const failed = unanswered(before);
  assert.equal(failed.phase, "pass-end");
  assert.equal(failed.notice, words.checkFailed);
  assert.equal(failed.retryable, true);
  assert.deepEqual(failed.history, before.history);
  assert.equal(failed.finishing, false);
  assert.equal(failed.finishPlayed, false);
  const shown = deriveDeck(entry, failed, presentation);
  assert.equal(shown.canRetry, true);
  assert.equal(shown.endTitle, words.complete);
  assert.notEqual(shown.endTitle, words.caughtUp);

  assert.equal(event(failed, { type: "count", operation: failed.operation, total: 0 }), failed);
  const retried = event(failed, { type: "retry" });
  assert.equal(retried.phase, "checking");
  assert.equal(retried.operation, failed.operation + 1);
  assert.equal(retried.notice, "");
  assert.equal(event(retried, { type: "count", operation: failed.operation, total: 0 }), retried);

  const empty = event(retried, { type: "count", operation: retried.operation, total: 0 });
  assert.equal(empty.phase, "caught-up");
  assert.equal(empty.finishing, true);
  assert.equal(empty.finishPlayed, true);
  assert.equal(deriveDeck(entry, empty, presentation).endTitle, words.caughtUp);
  assert.equal(deriveDeck(entry, empty, presentation).canRetry, false);
});

test("a retried final count that still finds rows ends the pass with no retry, no finish and no caught-up claim", () => {
  const retried = event(unanswered(counting()), { type: "retry" });
  const rows = event(retried, { type: "count", operation: retried.operation, total: 2 });
  assert.equal(rows.phase, "pass-end");
  assert.equal(rows.notice, "");
  assert.equal(rows.finishing, false);
  assert.equal(rows.finishPlayed, false);
  const shown = deriveDeck(entry, rows, presentation);
  assert.equal(shown.canRetry, false);
  assert.equal(shown.canRefresh, true);
  assert.equal(shown.endTitle, words.complete);
});

test("a retried final count nothing answers again offers the same retry over the same history", () => {
  const first = unanswered(counting());
  const again = unanswered(event(first, { type: "retry" }));
  assert.equal(again.phase, "pass-end");
  assert.equal(again.notice, words.checkFailed);
  assert.equal(again.retryable, true);
  assert.deepEqual(again.history, first.history);
  assert.equal(again.finishPlayed, false);
  assert.equal(deriveDeck(entry, again, presentation).canRetry, true);
  const third = event(again, { type: "retry" });
  assert.equal(third.phase, "checking");
  assert.equal(third.operation, again.operation + 1);
});

test("a final count failure the person cannot retry offers no retry and a retry changes nothing", () => {
  const refused = unanswered(counting(), false);
  assert.equal(refused.phase, "pass-end");
  assert.equal(deriveDeck(entry, refused, presentation).canRetry, false);
  assert.equal(event(refused, { type: "retry" }), refused);
});
