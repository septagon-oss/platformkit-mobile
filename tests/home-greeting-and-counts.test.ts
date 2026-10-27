// Home's first screen is a greeting and a few counts. The greeting's bands, the one
// word it may use, and the join between the counts body and the catalogue are decided
// here, on the two documents, with examples chosen independently of the code.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseCatalog, type Entry } from "../src/core/catalog";
import {
  firstName,
  greeting,
  workspaceName,
  deriveCopy,
  type Presentation,
} from "../src/core/derive";
import { rowCounts, statCards, cardLimit } from "../src/core/summary";
import type { Summary } from "../src/generated/types.gen";
import { presentation } from "./fakes/presentation";
import { unresolved } from "./fakes/unresolved";

const catalog = parseCatalog(
  unresolved(
    JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8")),
  ),
);
const note: Entry = catalog.resources.find((e) => e.entity === "note")!;

/** One reading of the greeting, at one instant, in one language. */
const greeted = (
  at: string,
  over: { readonly name?: string; readonly zone?: string; readonly language?: "en" | "pt" } = {},
) =>
  greeting(
    over.name === undefined ? undefined : { name: over.name },
    presentationAt(at, over.zone ?? "UTC", over.language ?? "en"),
  );

function presentationAt(at: string, zone: string, language: "en" | "pt"): Presentation {
  return { ...presentation, now: at, timeZone: zone, copy: deriveCopy(language) };
}

const named = (label: string): Entry => ({
  ...note,
  hints: { ...note.hints, highlight: { label } },
});

const summary = (...entries: readonly Record<string, unknown>[]): Summary =>
  ({ asOf: "2026-07-18T09:00:00Z", entries }) as Summary;

const days = (counts: readonly number[]) =>
  counts.map((count, index) => ({
    day: `2026-07-${String(index + 1).padStart(2, "0")}`,
    count,
  }));

test("the day divides at 05:00, 12:00 and 17:00 in the reader's own zone", () => {
  const bands: readonly [string, string, string][] = [
    ["2026-07-18T04:59:00Z", "UTC", "Good evening"],
    ["2026-07-18T05:00:00Z", "UTC", "Good morning"],
    ["2026-07-18T11:59:00Z", "UTC", "Good morning"],
    ["2026-07-18T12:00:00Z", "UTC", "Good afternoon"],
    ["2026-07-18T16:59:00Z", "UTC", "Good afternoon"],
    ["2026-07-18T17:00:00Z", "UTC", "Good evening"],
    ["2026-07-18T23:30:00Z", "UTC", "Good evening"],
    // The same instant, two zones: 10:30 UTC is after midnight in Kiribati, and the
    // person standing in the night is greeted for the night they are living.
    ["2026-07-18T10:30:00Z", "Pacific/Kiritimati", "Good evening"],
    ["2026-07-18T22:00:00Z", "Europe/Lisbon", "Good evening"],
  ];
  for (const [at, zone, expected] of bands)
    assert.equal(greeted(at, { zone }).line, expected, `${at} in ${zone}`);
});

test("a name is greeted by its first word and an address by none", () => {
  assert.equal(firstName("Ana Rita"), "Ana");
  assert.equal(firstName("Maria do Carmo"), "Maria");
  assert.equal(firstName("Mary-Jane Smith"), "Mary-Jane");
  assert.equal(firstName("  Joana  "), "Joana");
  assert.equal(firstName("Silva,"), "Silva");
  assert.equal(firstName("joao@acme.test"), "", "an address is not a name");
  assert.equal(firstName("  "), "");
  assert.equal(firstName("".padEnd(40, "a")), "", "too long to be one word");
});

test("the greeting says the name it was given, in the reader's language", () => {
  assert.equal(greeted("2026-07-18T09:00:00Z", { name: "Ana Rita" }).line, "Good morning, Ana");
  assert.equal(greeted("2026-07-18T14:00:00Z", { name: "Ana Rita" }).line, "Good afternoon, Ana");
  assert.equal(
    greeted("2026-07-18T09:00:00Z").line,
    "Good morning",
    "no name to greet says the part of day alone",
  );
  assert.equal(
    greeted("2026-07-18T09:00:00Z", { name: "joao@acme.test" }).line,
    "Good morning",
    "an address is never greeted by its local part",
  );
  assert.equal(
    greeted("2026-07-18T09:00:00Z", { name: "Ana", language: "pt" }).line,
    "Bom dia, Ana",
  );
  assert.equal(
    greeted("2026-07-18T20:00:00Z", { name: "Ana", language: "pt" }).line,
    "Boa noite, Ana",
  );
  assert.equal(greeted("2026-07-18T09:00:00Z", { language: "pt" }).line, "Bom dia");
});

test("the workspace is the address a person typed, and a word when it is not one", () => {
  assert.equal(workspaceName("https://acme.test/x", deriveCopy("en")), "acme.test");
  assert.equal(workspaceName("https://acme.test:8443", deriveCopy("en")), "acme.test:8443");
  assert.equal(workspaceName("not an address", deriveCopy("en")), "Workspace");
  assert.equal(workspaceName("not an address", deriveCopy("pt")), "Espaço de trabalho");
});

test("a card counts the total, names the sub-count the catalogue declared", () => {
  const entry = named("Due today");
  const trend = { field: "createdAt", days: days([0, 1, 0, 3, 2, 0, 1, 4, 0, 0, 2, 1, 0, 5]) };
  const [card] = statCards(
    summary({ module: "note", entity: "note", total: 128, highlight: 4, trend }),
    [entry],
    presentation,
  )!;
  assert.ok(card, "the body answered a total, so a card stands");
  assert.equal(card.key, "note/note");
  assert.equal(card.stat.label, "Notes");
  assert.equal(card.stat.text, "128");
  assert.equal(card.stat.percent, undefined, "the body gave no baseline to compare with");
  assert.equal(card.secondary, "Due today · 4");
  assert.equal(card.aloud, "Notes: 128. Due today · 4.");
  assert.equal(card.spark?.empty, false, "the fortnight the body drew is drawn");
  assert.equal(card.target, entry);
  assert.deepEqual(
    rowCounts(summary({ module: "note", entity: "note", total: 128 }), [entry], presentation),
    {
      "note/note": "128",
    },
  );
});

test("absence stays absence: no card, no count and no zero anywhere", () => {
  const cards = statCards(summary({ module: "note", entity: "note" }), [note], presentation);
  assert.equal(cards.length, 0);
  assert.deepEqual(
    rowCounts(summary({ module: "note", entity: "note" }), [note], presentation),
    {},
  );
  assert.equal(
    cards.some((c) => c.stat.text === "0"),
    false,
  );
});

test("an answered zero is an answer: the card and the row both say 0", () => {
  const [card] = statCards(
    summary({ module: "note", entity: "note", total: 0 }),
    [note],
    presentation,
  )!;
  assert.ok(card, "a zero is an answer, so a card stands");
  assert.equal(card.stat.text, "0");
  assert.equal(card.aloud, "Notes: 0.");
  assert.deepEqual(
    rowCounts(summary({ module: "note", entity: "note", total: 0 }), [note], presentation),
    {
      "note/note": "0",
    },
  );
});

test("a highlight with no total is the headline, and only in the catalogue's word", () => {
  const [card] = statCards(
    summary({ module: "note", entity: "note", highlight: 3 }),
    [named("Due today")],
    presentation,
  )!;
  assert.ok(card, "the catalogue named the highlight, so a card stands");
  assert.equal(card.stat.text, "3");
  assert.equal(card.stat.label, "Due today");
  assert.equal(card.secondary, undefined, "there is no second number beside it");
  assert.equal(
    statCards(summary({ module: "note", entity: "note", highlight: 3 }), [note], presentation)
      .length,
    0,
    "no declared word means no card: the phone writes no label of its own",
  );
});

test("a highlight nobody named is not drawn under a total that was answered", () => {
  const [card] = statCards(
    summary({ module: "note", entity: "note", total: 10, highlight: 2 }),
    [note],
    presentation,
  )!;
  assert.ok(card, "the total was answered, so a card stands");
  assert.equal(card.stat.text, "10");
  assert.equal(card.stat.label, "Notes");
  assert.equal(card.secondary, undefined);
  assert.equal(card.aloud, "Notes: 10.");
});

test("an entry nobody handed the phone is dropped, and the rest is untouched", () => {
  const cards = statCards(
    summary(
      { module: "billing", entity: "invoice", total: 9 },
      { module: "note", entity: "note", total: 2 },
    ),
    [note],
    presentation,
  );
  assert.deepEqual(
    cards.map((c) => c.key),
    ["note/note"],
  );
  assert.deepEqual(
    Object.keys(
      rowCounts(summary({ module: "billing", entity: "invoice", total: 9 }), [note], presentation),
    ),
    [],
  );
});

test("the body's own order stands, and three is the most one screen leads with", () => {
  const four = catalog.resources.slice(0, 4);
  const body = summary(...four.map((e) => ({ module: e.module, entity: e.entity, total: 1 })));
  const cards = statCards(body, four, presentation);
  assert.equal(cards.length, cardLimit);
  assert.deepEqual(
    cards.map((c) => c.key),
    four.slice(0, cardLimit).map((e) => `${e.module}/${e.entity}`),
  );
  assert.deepEqual(statCards(summary(), [], presentation), []);
});

test("an empty window draws no shape, and fourteen quiet days draw a flat one", () => {
  const [flat] = statCards(
    summary({
      module: "note",
      entity: "note",
      total: 4,
      trend: { field: "createdAt", days: days([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) },
    }),
    [note],
    presentation,
  )!;
  assert.ok(flat, "fourteen quiet days are still a fortnight");
  assert.equal(flat.spark?.empty, false);
  assert.equal(flat.stat.text, "4");
  for (const trend of [
    { field: "createdAt", days: [] },
    { field: "createdAt", days: null },
  ]) {
    const [card] = statCards(
      summary({ module: "note", entity: "note", total: 4, trend }),
      [note],
      presentation,
    )!;
    assert.ok(card, "the body answered a total, so a card stands");
    assert.equal(card.spark, undefined, "a card with a number and no shape");
    assert.equal(card.stat.text, "4");
  }
});

test("the row's count and the card's number are one formatting of one integer", () => {
  const counts = rowCounts(
    summary({ module: "note", entity: "note", total: 1234 }),
    [note],
    presentation,
  );
  const [card] = statCards(
    summary({ module: "note", entity: "note", total: 1234 }),
    [note],
    presentation,
  )!;
  assert.ok(card, "the body answered a total, so a card stands");
  assert.equal(counts["note/note"], "1,234");
  assert.equal(counts["note/note"], card.stat.text);
});

test("a highlight enters through the catalogue and a broken one says so", () => {
  const golden = () =>
    unresolved(
      JSON.parse(
        readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8"),
      ),
    );
  const served = (hints: unknown) => {
    const doc = golden();
    doc.resources[0].presentation = { ...(doc.resources[0].presentation ?? {}), highlight: hints };
    const lines: string[] = [];
    const parsed = parseCatalog(doc, (at, why) => lines.push(`${at} ${why}`));
    return { entry: parsed.resources[0]!, lines };
  };
  assert.deepEqual(served({ label: "Due today", filter: [] }).entry.hints?.highlight, {
    label: "Due today",
  });
  assert.deepEqual(served("Due today").lines, [
    "resources[0].presentation.highlight is not a hint object: the sub-count is not drawn",
  ]);
  assert.deepEqual(served({ label: 4 }).lines, [
    "resources[0].presentation.highlight.label is not a word: the default is used",
  ]);
  assert.deepEqual(served({ label: "" }).entry.hints?.highlight, undefined);
  // The rest of the entry's readings survive a sub-count nobody declared.
  const rest = served({ label: "" });
  assert.equal(rest.entry.hints?.plural, undefined);
  assert.deepEqual(rest.lines, []);
});
