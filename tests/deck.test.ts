// A finite pass counts confirmed choices, keeps deferred skips rewindable, and never credits an unanswered write.
import assert from "node:assert/strict";
import test from "node:test";
import {
  deckCanRewind,
  deckChoices,
  deckEvent,
  deckWindow,
  reviewDeck,
  startDeck,
  type DeckInput,
  type DeckState,
} from "../src/core/deck";
import { parseCatalog } from "../src/core/catalog";
import { deckCommand, deckEntry, deriveDeck, type Row } from "../src/core/derive";
import { presentation } from "./fakes/presentation";
import { deckDocument, deckEntryFixture, deckRows } from "./fakes/deck";

const entry = deckEntryFixture();
const deck = reviewDeck(entry)!;
function event(s: DeckState, input: DeckInput): DeckState {
  return deckEvent(s, { ...input, session: s.session });
}
function ready(rows: readonly Row[] = deckRows) {
  const s = startDeck(deck);
  return event(s, { type: "page", operation: 1, offset: 0, items: rows, total: rows.length });
}
function settle(s: DeckState) {
  return event(s, { type: "settled", operation: s.operation });
}
function skip(s: DeckState) {
  return settle(event(s, { type: "choose", direction: "down", confirmation: false }));
}

test("capture freezes the first total and advances by raw page length before allowing choices", () => {
  let s = startDeck(deck);
  const rows = Array.from({ length: 20 }, (_, i) => ({ id: String(i), title: `Item ${i}` }));
  s = event(s, { type: "page", operation: 1, offset: 0, items: rows, total: 23 });
  assert.equal(s.phase, "loading");
  assert.deepEqual(deckChoices(s), []);
  assert.deepEqual(deckWindow(s, 20), {
    offset: 20,
    limit: 3,
    sort: "title",
    filters: ["status:open"],
  });
  s = event(s, {
    type: "page",
    operation: 1,
    offset: 20,
    items: [rows[2]!, { id: "21" }, { id: "22" }],
    total: 23,
  });
  assert.equal(s.active.length, 22);
  assert.equal(s.changed, true);
  assert.equal(s.rows["2"], rows[2]);
  assert.equal(s.phase, "ready");
});

test("skip and rewind preserve a finite active order and share the history-derived denominator", () => {
  let s = skip(skip(ready()));
  assert.deepEqual(s.active, ["C"]);
  assert.deepEqual(s.deferred, ["A", "B"]);
  s = settle(event(s, { type: "rewind" }));
  assert.deepEqual(s.active, ["B", "C"]);
  assert.deepEqual(s.deferred, ["A"]);
  assert.equal(s.history.length, 1);
  assert.equal(deriveDeck(entry, s, presentation).progress?.text, "1 of 3");
  s = settle(event(s, { type: "rewind" }));
  assert.deepEqual(s.active, ["A", "B", "C"]);
  assert.equal(s.history.length, 0);
});

test("a confirmed command is an undo barrier and duplicate acceptance cannot credit twice", () => {
  let s = skip(ready());
  s = event(s, { type: "choose", direction: "right", confirmation: false });
  const operation = s.operation;
  assert.equal(s.phase, "submitting");
  assert.equal(s.history.length, 1);
  assert.equal(event(s, { type: "choose", direction: "down", confirmation: false }), s);
  s = event(s, { type: "accepted", operation });
  assert.equal(event(s, { type: "accepted", operation }), s);
  s = settle(s);
  assert.equal(s.history.length, 2);
  assert.equal(deckCanRewind(s), false);
  assert.equal(event(s, { type: "rewind" }), s);
});

test("confirmation locks every choice until cancellation or its single matching answer", () => {
  let s = event(ready(), { type: "choose", direction: "left", confirmation: true });
  assert.equal(s.phase, "confirming");
  assert.deepEqual(deckChoices(s), []);
  assert.equal(event(s, { type: "accepted", operation: s.operation }), s);
  s = event(s, { type: "cancel", operation: s.operation });
  assert.equal(s.phase, "ready");
  assert.equal(s.history.length, 0);
  s = event(s, { type: "choose", direction: "left", confirmation: true });
  s = event(s, { type: "confirm", operation: s.operation });
  assert.equal(s.phase, "submitting");
});

test("refusal restores the same card without history and blocks its intent until a live revalidation", () => {
  let s = event(ready(), { type: "choose", direction: "right", confirmation: false });
  s = settle(
    event(s, { type: "refused", operation: s.operation, text: "No access", missing: false }),
  );
  assert.equal(s.active[0], "A");
  assert.equal(s.history.length, 0);
  assert.equal(s.notice, "No access");
  assert.deepEqual(deckChoices(s), ["left", "down"]);
  s = event(s, { type: "refresh" });
  s = event(s, { type: "page", operation: s.operation, offset: 0, total: 3, items: deckRows });
  assert.deepEqual(deckChoices(s), ["left", "down", "right"]);
});

test("held and unknown results keep the card locked and never become choices", () => {
  for (const type of ["held", "unknown"] as const) {
    let s = event(ready(), { type: "choose", direction: "right", confirmation: false });
    s = event(s, {
      type,
      operation: s.operation,
      text: "Unconfirmed",
      ...(type === "held" ? { heldID: "stored" } : {}),
    });
    assert.equal(s.phase, type);
    assert.equal(s.history.length, 0);
    assert.equal(s.active[0], "A");
    assert.equal(event(s, { type: "refresh" }), s);
    assert.equal(event(s, { type: "rewind" }), s);
    assert.equal(event(s, { type: "accepted", operation: s.operation }), s);
  }
});

test("a resolved held or unknown choice offers a fresh capture without crediting the old intent", () => {
  const rows = [{ id: "new", title: "Elm" }];
  for (const type of ["held", "unknown"] as const) {
    let s = event(skip(ready()), { type: "choose", direction: "right", confirmation: false });
    const former = s;
    s = event(s, { type, operation: s.operation, heldID: "stored", text: "Unconfirmed" });
    s = event(s, { type: "close" });
    assert.equal(s.phase, "closed");
    assert.deepEqual(s.history, []);
    assert.deepEqual(s.active, []);
    assert.deepEqual(s.deferred, []);
    assert.deepEqual(s.rows, {});
    assert.equal(s.pending, undefined);
    const model = deriveDeck(entry, s, presentation);
    assert.equal(model.canRefresh, true);
    assert.deepEqual(model.stack, []);
    assert.deepEqual(model.available, []);
    assert.equal(model.progress, undefined);
    assert.equal(model.finishing, false);
    assert.equal(event(s, { type: "accepted", operation: former.operation }), s);
    s = event(s, { type: "refresh" });
    assert.equal(s.phase, "loading");
    assert.equal(deckWindow(s, 20).offset, 0);
    const page = {
      type: "page" as const,
      operation: s.operation,
      offset: 0,
      items: rows,
      total: 1,
    };
    assert.equal(deckEvent(s, { ...page, session: former.session }), s);
    s = event(s, page);
    assert.equal(s.phase, "ready");
    assert.deepEqual(s.active, ["new"]);
    assert.deepEqual(deckChoices(s), ["left", "down", "right"]);
    s = event(s, { type: "choose", direction: "right", confirmation: false });
    assert.ok(s.operation > former.operation);
    assert.equal(event(s, { type: "accepted", operation: former.operation }), s);
    assert.deepEqual(s.history, []);
  }
});

test("skip-only decks finish their pass without claiming the server queue is empty", () => {
  let s = skip(skip(skip(ready())));
  assert.equal(s.phase, "checking");
  s = event(s, { type: "count", operation: s.operation, total: 3 });
  assert.equal(s.phase, "pass-end");
  assert.equal(s.finishing, false);
  const model = deriveDeck(entry, s, presentation);
  assert.equal(model.endTitle, "Review complete");
  assert.equal(model.progress?.text, "3 of 3");
  assert.equal(model.counts[1]?.label, "3 left for later");
  assert.equal(deckCanRewind(s), true);
});

test("only a live empty total after a confirmed command earns a single finishing moment", () => {
  let s = ready([deckRows[0]!]);
  s = event(s, { type: "choose", direction: "right", confirmation: false });
  s = settle(event(s, { type: "accepted", operation: s.operation }));
  s = event(s, { type: "count", operation: s.operation, total: 0 });
  assert.equal(s.finishing, true);
  assert.equal(s.finishPlayed, true);
  s = event(s, { type: "finish-end", operation: s.operation });
  assert.equal(event(s, { type: "count", operation: s.operation, total: 0 }), s);
  let empty = ready([]);
  empty = event(empty, { type: "count", operation: empty.operation, total: 0 });
  assert.equal(empty.finishing, false);
  assert.equal(deriveDeck(entry, empty, presentation).progress, undefined);
});

test("revalidation removes missing active cards without credit and cannot rewind a missing deferred card", () => {
  let s = skip(ready());
  s = event(s, { type: "suspend" });
  s = event(s, { type: "resume" });
  s = event(s, {
    type: "page",
    operation: s.operation,
    offset: 0,
    total: 2,
    items: [deckRows[1]!, { id: "D" }],
  });
  assert.deepEqual(s.active, ["B"]);
  assert.deepEqual(s.deferred, []);
  assert.equal(s.history.length, 1);
  assert.equal(deckCanRewind(s), false);
  assert.equal(deriveDeck(entry, s, presentation).progress?.text, "1 of 2");
});

test("encouragement survives rewind and obsolete operation or session callbacks have no effect", () => {
  let s = ready(Array.from({ length: 6 }, (_, i) => ({ id: String(i), title: String(i) })));
  for (let i = 0; i < 5; i++) s = skip(s);
  assert.equal(s.encouraged, true);
  s = settle(event(s, { type: "rewind" }));
  assert.equal(s.encouraged, true);
  assert.equal(s.history.length, 4);
  assert.equal(
    deckEvent(s, { type: "settled", session: s.session + 1, operation: s.operation }),
    s,
  );
  assert.equal(event(s, { type: "settled", operation: s.operation - 1 }), s);
});

test("missing identities and invalid totals fail capture instead of fabricating an empty pass", () => {
  for (const total of [-1, NaN, 1.2])
    assert.throws(() =>
      event(startDeck(deck), { type: "page", operation: 1, offset: 0, items: [], total }),
    );
  assert.throws(() =>
    event(startDeck(deck), {
      type: "page",
      operation: 1,
      offset: 0,
      items: [{ title: "No ID" }],
      total: 1,
    }),
  );
});

test("catalog normalization resolves defaulted row commands and refuses an invalid deck atomically", () => {
  const doc = deckDocument();
  doc.resources[0].commands[0].fields = [{ name: "reason", type: "string", default: "agreed" }];
  assert.equal(deckCommand(parseCatalog(doc).resources[0]!, "right")?.verb, "accept");
  for (const mutate of [
    (d: ReturnType<typeof deckDocument>) => {
      delete d.resources[0].commands[0].fields[0].default;
    },
    (d: ReturnType<typeof deckDocument>) => {
      d.resources[0].presentation.deck.directions.north = { skip: true };
    },
    (d: ReturnType<typeof deckDocument>) => {
      d.resources[0].presentation.deck.queue = [];
    },
    (d: ReturnType<typeof deckDocument>) => {
      d.resources[0].presentation.deck.order = "-missing";
    },
    (d: ReturnType<typeof deckDocument>) => {
      d.resources[0].presentation.deck.directions.left.command = "missing";
    },
  ]) {
    const changed = structuredClone(doc);
    mutate(changed);
    const notices: string[] = [];
    const parsed = parseCatalog(changed, (path) => notices.push(path));
    assert.equal(parsed.resources[0]?.hints?.deck, undefined);
    assert.equal(notices.length, 1);
    assert.match(notices[0]!, /presentation\.deck/);
  }
});

test("toolbar uses the queue's own count, suppresses empty or unauthorized choices, and preserves valid skip-only decks", () => {
  assert.equal(deckEntry(entry, 6, false, "", presentation)?.label, "Review 6");
  assert.equal(deckEntry(entry, 0, false, "", presentation)?.enabled, false);
  const doc = deckDocument();
  doc.resources[0].presentation.deck.directions = {};
  const unauthorized = parseCatalog(doc).resources[0]!;
  assert.equal(deckEntry(unauthorized, 6, false, "", presentation)?.enabled, false);
  doc.resources[0].presentation.deck.directions = { down: { skip: true } };
  assert.equal(
    deckEntry(parseCatalog(doc).resources[0]!, 2, false, "", presentation)?.enabled,
    true,
  );
});

test("a deck loads only its three drawn covers or thumbnail fallbacks, preserving the outgoing card during settlement", () => {
  const file = "00000000-0000-4000-8000-000000000005";
  const thumbnail = "00000000-0000-4000-8000-000000000006";
  const pictured = {
    ...entry,
    fields: [
      ...entry.fields,
      { name: "cover", type: "uuid" as const, present: "image" },
      { name: "thumb", type: "uuid" as const, present: "image" },
    ],
    hints: { ...entry.hints, coverField: "cover", thumbnailField: "thumb" },
  };
  const rows = [
    { ...deckRows[0], cover: file, thumb: thumbnail },
    { ...deckRows[1], thumb: thumbnail },
    deckRows[2]!,
    { id: "D", title: "Later", cover: file },
  ];
  let state = ready(rows);
  const pictureIDs = (s: DeckState) =>
    deriveDeck(pictured, s, presentation, { files: {}, states: {} }).stack.map(
      (card) => card.image?.id,
    );
  assert.deepEqual(pictureIDs(state), [file, thumbnail, undefined]);
  state = event(state, { type: "choose", direction: "down", confirmation: false });
  assert.deepEqual(pictureIDs(state), [file, thumbnail, undefined]);
  state = settle(state);
  assert.deepEqual(pictureIDs(state), [thumbnail, undefined, file]);
});
