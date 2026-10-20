// A pass the deck closes after a held or unknown choice never hands its operation numbers to the
// next pass. The screen remembers what it already asked to confirm and already sent by number alone,
// so a restarted pass that reused one would skip its confirmation or swallow its command.
import assert from "node:assert/strict";
import test from "node:test";
import { deckEvent, reviewDeck, startDeck, type DeckInput, type DeckState } from "../src/core/deck";
import { deckEntryFixture, deckRows } from "./fakes/deck";

const deck = reviewDeck(deckEntryFixture())!;
function event(s: DeckState, input: DeckInput): DeckState {
  return deckEvent(s, { ...input, session: s.session });
}

test("a pass restarted after a held or unknown choice uses operation numbers the closed pass never issued", () => {
  for (const type of ["held", "unknown"] as const) {
    const issued = new Set<number>();
    const step = (s: DeckState, input: DeckInput) => {
      const next = event(s, input);
      issued.add(next.operation);
      return next;
    };
    let s = startDeck(deck);
    issued.add(s.operation);
    const page = { type: "page" as const, offset: 0, items: deckRows, total: deckRows.length };
    s = step(s, { ...page, operation: s.operation });
    s = step(s, { type: "choose", direction: "left", confirmation: true });
    assert.equal(s.phase, "confirming");
    s = step(s, { type: "cancel", operation: s.operation });
    s = step(s, { type: "choose", direction: "right", confirmation: false });
    assert.equal(s.phase, "submitting");
    s = step(s, { type, operation: s.operation, text: "Unconfirmed", heldID: "stored" });
    assert.equal(s.phase, type);

    s = event(s, { type: "close" });
    assert.equal(s.phase, "closed");
    assert.equal(issued.has(s.operation), false);
    s = event(s, { type: "refresh" });
    const rest = deckRows.slice(1);
    s = event(s, {
      type: "page",
      operation: s.operation,
      offset: 0,
      items: rest,
      total: rest.length,
    });
    assert.equal(s.phase, "ready");

    s = event(s, { type: "choose", direction: "left", confirmation: true });
    assert.equal(s.phase, "confirming");
    assert.equal(issued.has(s.operation), false, `${type}: confirmation ${s.operation} was issued`);
    for (const n of issued) assert.equal(event(s, { type: "confirm", operation: n }), s);
    s = event(s, { type: "cancel", operation: s.operation });
    s = event(s, { type: "choose", direction: "right", confirmation: false });
    assert.equal(s.phase, "submitting");
    assert.equal(issued.has(s.pending!.operation), false, `${type}: command was issued`);
    for (const n of issued) assert.equal(event(s, { type: "accepted", operation: n }), s);
  }
});
