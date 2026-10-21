// The deck draws its finishing moment only where motion is normal: an empty live count after a
// confirmed command asks for it once, normal motion plays it until it ends, and reduced motion keeps
// the still "caught up" state with the same counts. An unanswered final count asks for no finish in
// either motion; its retried count that finds the queue empty does.
import assert from "node:assert/strict";
import test from "node:test";
import { deckEvent, reviewDeck, startDeck, type DeckInput, type DeckState } from "../src/core/deck";
import { deriveDeck, type Presentation } from "../src/core/derive";
import { presentation as still } from "./fakes/presentation";
import { deckEntryFixture, deckRows } from "./fakes/deck";

const entry = deckEntryFixture();
const deck = reviewDeck(entry)!;
const moving: Presentation = { ...still, motion: "normal" };
const words = still.copy.review;
function event(s: DeckState, input: DeckInput): DeckState {
  return deckEvent(s, { ...input, session: s.session });
}

/** decided confirms one command on a one-card queue and stops at the final count. */
function decided(): DeckState {
  let s = startDeck(deck);
  s = event(s, {
    type: "page",
    operation: s.operation,
    offset: 0,
    items: [deckRows[0]!],
    total: 1,
  });
  s = event(s, { type: "choose", direction: "right", confirmation: false });
  s = event(s, { type: "accepted", operation: s.operation });
  s = event(s, { type: "settled", operation: s.operation });
  assert.equal(s.phase, "checking");
  return s;
}

test("an empty live count after a command plays the finish under normal motion until it ends", () => {
  const before = decided();
  const empty = event(before, { type: "count", operation: before.operation, total: 0 });
  assert.equal(empty.phase, "caught-up");
  assert.equal(deriveDeck(entry, empty, moving).finishing, true);
  assert.equal(deriveDeck(entry, empty, moving).endTitle, words.caughtUp);
  const ended = event(empty, { type: "finish-end", operation: empty.operation });
  assert.equal(deriveDeck(entry, ended, moving).finishing, false);
  assert.equal(deriveDeck(entry, ended, moving).endTitle, words.caughtUp);
});

test("reduced motion keeps the still caught-up state with the same counts and no finish", () => {
  const before = decided();
  const empty = event(before, { type: "count", operation: before.operation, total: 0 });
  const shown = deriveDeck(entry, empty, still);
  assert.equal(shown.finishing, false);
  assert.equal(shown.endTitle, words.caughtUp);
  assert.deepEqual(shown.counts, deriveDeck(entry, empty, moving).counts);
});

test("an unanswered final count asks for no finish in either motion and its empty retry plays it", () => {
  const before = decided();
  const failed = event(before, {
    type: "read-failed",
    operation: before.operation,
    text: words.checkFailed,
    retryable: true,
    withdraw: false,
  });
  assert.equal(deriveDeck(entry, failed, moving).finishing, false);
  assert.equal(deriveDeck(entry, failed, still).finishing, false);
  const retried = event(failed, { type: "retry" });
  const empty = event(retried, { type: "count", operation: retried.operation, total: 0 });
  assert.equal(deriveDeck(entry, empty, moving).finishing, true);
  assert.equal(deriveDeck(entry, empty, still).finishing, false);
});
