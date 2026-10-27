// summary.ts reads the counts the installation answers for the whole workspace and
// decides what a card may say with them. It is the only place the two documents —
// the counts body and the catalogue — are joined.
//
// The body answers integers and dates and no word; the catalogue answers the words
// (`presentation.highlight`) and the names every number counts. Every number in the
// body is a pointer: an absent key means *nobody answered* and a `0` means *this
// workspace holds none of those*, so the two stay distinct here and nowhere else, and
// nothing outside this file may write `?? 0` over an answer it did not get.
import { deriveSparkline, deriveStat } from "./charts";
import type { ChartInput, SparklineModel, StatModel } from "./charts";
import { key, type Entry } from "./catalog";
import { noun } from "./present";
import type { Presentation } from "./presentation";
import type { Summary, SummaryEntry, Trend } from "../generated/types.gen";

/** cardLimit is how many cards Home shows at most: what one thumb sweeps at once. */
export const cardLimit = 3;

/**
 * StatCardModel is one card: the headline number with its word, the sub-count the
 * catalogue named if there was one to name, the fortnight's shape if the body drew
 * one, and the entry a press opens. `aloud` is the card's whole sentence, which is
 * what `spark` gives up being read for to stay a shape.
 */
export interface StatCardModel {
  readonly key: string;
  readonly stat: StatModel;
  readonly secondary?: string;
  readonly spark?: SparklineModel;
  readonly aloud: string;
  readonly target: Entry;
}

/**
 * statCards joins the counts body to the caller's catalogue and returns the cards.
 *
 * An entry the caller was never handed is dropped — the body naming a resource says
 * nothing about whether this person may open it — and an entry the body gave no
 * number for produces no card. The body's own order is kept and the first
 * `cardLimit` cards are returned: which count matters most to a tenant is a
 * catalogue question, and until the catalogue says it this file inventing a priority
 * would be the phone guessing at a fact it does not hold.
 *
 * `summary` is undefined while the read is out or when it refused, which is no cards
 * rather than cards of zero: a count with no stated age is a claim about now.
 */
export function statCards(
  summary: Summary | undefined,
  entries: readonly Entry[],
  p: Presentation,
): readonly StatCardModel[] {
  const cards: StatCardModel[] = [];
  for (const answered of summary?.entries ?? []) {
    const entry = entries.find((e) => key(e) === `${answered.module}/${answered.entity}`);
    if (!entry) continue;
    const card = statCard(entry, answered, p);
    if (card) cards.push(card);
    if (cards.length === cardLimit) return cards;
  }
  return cards;
}

/**
 * rowCounts is the same body read for the rows rather than the cards: every entry the
 * caller holds whose total was answered, keyed `module/entity`, holding the number in
 * the reader's own digits. An unanswered total is absent from the map, and a row with
 * no entry in it draws no number; a `0` is an answer and is drawn.
 */
export function rowCounts(
  summary: Summary | undefined,
  entries: readonly Entry[],
  p: Presentation,
): Readonly<Record<string, string>> {
  const counts: Record<string, string> = {};
  for (const answered of summary?.entries ?? []) {
    const entry = entries.find((e) => key(e) === `${answered.module}/${answered.entity}`);
    if (!entry || answered.total === undefined) continue;
    const text = stat(noun(entry).plural, answered.total, p);
    if (text) counts[key(entry)] = text.text;
  }
  return counts;
}

/** stat is one whole count: no baseline, no delta and no tone, because the body gives no comparison. */
function stat(label: string, value: number, p: Presentation): StatModel | undefined {
  const result = deriveStat({ label, value, fractionDigits: 0, preference: "neutral" }, p);
  return result.ok ? result.value : undefined;
}

/**
 * statCard is one entry's card. The headline is the total when the body answered one
 * and the highlight when it answered only that; with neither there is no card, which
 * is the absence the server chose, not a zero of the phone's making. A headline built
 * on a highlight needs the catalogue's word for it — the body carries no word, and the
 * phone may not write one — so an undeclared highlight headline draws nothing.
 */
function statCard(
  entry: Entry,
  answered: SummaryEntry,
  p: Presentation,
): StatCardModel | undefined {
  const named = entry.hints?.highlight?.label;
  const headline =
    answered.total !== undefined
      ? { value: answered.total, label: noun(entry).plural, counted: answered.highlight }
      : answered.highlight !== undefined && named !== undefined
        ? { value: answered.highlight, label: named }
        : undefined;
  if (!headline) return undefined;
  const model = stat(headline.label, headline.value, p);
  if (!model) return undefined;
  const spark = answered.trend ? sparkline(entry, answered.trend, p) : undefined;
  // Both numbers and a declared word for the second one, or no second line: a count
  // the catalogue never named is a number the phone has no right to label.
  const secondary =
    answered.total !== undefined && answered.highlight !== undefined && named !== undefined
      ? p.copy.kit.cardSecondary(named, stat(named, answered.highlight, p)?.text ?? "")
      : undefined;
  return {
    key: key(entry),
    stat: model,
    ...(secondary === undefined ? {} : { secondary }),
    ...(spark === undefined ? {} : { spark }),
    aloud: p.copy.kit.cardAloud(headline.label, model.text, secondary),
    target: entry,
  };
}

/**
 * sparkline draws the window the body gave: no day added, no day dropped, no
 * re-windowing, and a flat line at zero is the truth about a quiet fortnight. The
 * days are the server's UTC days, which is why they are a shape and never labelled as
 * dates, and the axis labels only exist because `ChartInput` requires them — no
 * screen of this kit draws a sparkline's axis.
 *
 * An empty window produces no sparkline at all rather than a molecule saying it has
 * nothing to show: a card with a number and no shape is the card the body described.
 */
function sparkline(entry: Entry, trend: Trend, p: Presentation): SparklineModel | undefined {
  const days = trend.days ?? [];
  if (days.length === 0) return undefined;
  const named = noun(entry).plural;
  const input: ChartInput = {
    content: {
      phase: "ready",
      refresh: "idle",
      value: [
        {
          id: `${key(entry)}.${trend.field}`,
          label: named,
          tone: "info",
          // The day key is the point's id because it is stable and names nothing a
          // person reads; the x is the ordinal in the window, so the shape needs no
          // calendar to be drawn and no formatted instant enters the model.
          points: days.map((day, index) => ({ id: day.day, x: index + 1, y: day.count })),
        },
      ],
    },
    xKind: "number",
    xLabel: p.copy.kit.day,
    yLabel: named,
    unitLabel: named,
    fractionDigits: 0,
    ranges: [],
  };
  const result = deriveSparkline(input, p);
  return result.ok && !result.value.empty ? result.value : undefined;
}
