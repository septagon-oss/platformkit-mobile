/** deck: one record as a review card, with the command it asks for. */
import { Entry } from "../catalog";
import { deckCanRefresh, deckCanRewind, deckChoices, type DeckState, reviewDeck } from "../deck";
import { type Formatting, type Presentation } from "../presentation";
import { type DeckDirection, deckDirections } from "../catalogDeck";
import { drawnIcon } from "../pictures";
import { deriveMeter } from "../progress";
import { PendingWrite } from "../outbox";
import { type RecordPictures, type Row, recordCover } from "./header";
import { badgeTone, label, noun, plural } from "../present";
import { commandOf, commandPath, offered } from "../command";
import { listRow } from "../list";
import { kind, writePath } from "../form";

/** deckEntry is the toolbar's live queue count, independent of ordinary list filters. */
export function deckEntry(
  entry: Entry,
  total: number | undefined,
  loading: boolean,
  error: string,
  format: Formatting,
) {
  const deck = reviewDeck(entry);
  if (!deck) return undefined;
  const available = Object.keys(deck.directions).length > 0;
  return {
    label:
      total === undefined
        ? format.copy.review.title
        : format.copy.review.open(new Intl.NumberFormat(format.locale).format(total)),
    enabled: available && !loading && total !== undefined && total > 0,
    loading,
    error,
    reason: available ? "" : format.copy.review.unavailable,
    retry: format.copy.state.retry,
  };
}

/** deckCommand resolves a currently offered direction through the entry's own command owner. */
export function deckCommand(entry: Entry, direction: string) {
  const choice = reviewDeck(entry)?.directions[direction as DeckDirection];
  return choice && "command" in choice ? commandOf(entry, choice.command, "record") : undefined;
}

/** deriveDeck draws one finite pass; history is the sole source of progress and direction counts. */
export function deriveDeck(
  entry: Entry,
  state: DeckState,
  p: Presentation,
  pictures?: RecordPictures,
) {
  const available = deckChoices(state);
  const controls = deckDirections.flatMap((direction) => {
    const choice = state.deck.directions[direction];
    if (!choice) return [];
    return [
      {
        id: direction,
        label: "skip" in choice ? p.copy.review.later : choice.label,
        icon: "skip" in choice ? ("clock" as const) : (drawnIcon(choice.icon) ?? "document"),
        tone: "skip" in choice ? ("neutral" as const) : badgeTone(choice.tone),
        enabled: available.includes(direction),
        busy: state.phase === "submitting" && state.pending?.direction === direction,
      },
    ];
  });
  const rewind = {
    id: "rewind",
    label: p.copy.kit.rewind,
    icon: "rewind" as const,
    tone: "neutral" as const,
    enabled: true,
    busy: false,
  };
  const actions = [...(deckCanRewind(state) ? [rewind] : []), ...controls];
  const visible = ["loading", "read-error", "withdrawn", "closed", "suspended"].includes(
    state.phase,
  )
    ? []
    : state.active
        .slice(0, 3)
        .map((id) => state.rows[id]!)
        .filter(Boolean);
  const card = (row: Row, index: number) => {
    const line = listRow(
      entry,
      row,
      p,
      p.copy.kit.untitled,
      undefined,
      !!pictures,
      pictures?.states,
    );
    const cover = pictures
      ? recordCover(entry, row, pictures, { width: 4, height: 3 })?.picture
      : undefined;
    const image =
      cover?.slot ?? (line.media?.kind === "picture" ? line.media.image.slot : undefined);
    const imageState =
      cover?.item.state ?? (line.media?.kind === "picture" ? line.media.image.state : undefined);
    const facts = line.cells.slice(0, 2);
    return {
      id: row.id as string,
      title: line.title,
      summary: line.summary,
      status: line.status,
      facts,
      image,
      imageState,
      imageFailure: p.copy.kit.imageUnavailable,
      name: [
        line.title,
        line.status?.label,
        line.summary,
        ...facts.map((f) => `${f.label}: ${f.spoken ?? f.value}`),
      ]
        .filter(Boolean)
        .join(". "),
      depth: index,
      scale: index === 1 ? 0.95 : index === 2 ? 0.9 : 1,
      actions: actions.map((a) => ({ name: a.id, label: a.label })),
    };
  };
  const total = state.history.length + state.active.length;
  const meter =
    total > 0
      ? deriveMeter({ value: state.history.length, max: total, label: p.copy.review.title }, p)
      : undefined;
  const end = ["pass-end", "caught-up"].includes(state.phase);
  const counts = end
    ? controls.map((c) => ({
        label:
          c.id === "down" && state.deck.directions.down && "skip" in state.deck.directions.down
            ? p.copy.review.deferred(
                new Intl.NumberFormat(p.locale).format(
                  state.history.filter((h) => h.direction === c.id).length,
                ),
              )
            : `${c.label}: ${new Intl.NumberFormat(p.locale).format(state.history.filter((h) => h.direction === c.id).length)}`,
      }))
    : [];
  const endTitle = end
    ? state.phase === "caught-up"
      ? p.copy.review.caughtUp
      : p.copy.review.complete
    : "";
  return {
    actions,
    available,
    stack: (state.transition?.kind === "choice"
      ? [state.transition.row, ...visible.slice(0, 2)]
      : visible
    ).map(card),
    busy: !["ready", "pass-end", "caught-up"].includes(state.phase),
    canOpen: state.phase === "ready",
    loading: ["loading", "checking", "suspended"].includes(state.phase),
    loadingLabel: p.copy.state.loading,
    finishing: state.finishing && p.motion === "normal",
    notice: state.notice,
    changed: state.changed ? p.copy.review.changed : "",
    unavailable: Object.keys(state.deck.directions).length ? "" : p.copy.review.unavailable,
    encouragement: state.encouraged ? p.copy.review.encouraged : "",
    progress: meter?.ok ? meter.value : undefined,
    endTitle,
    counts,
    endName: [endTitle, ...counts.map((count) => count.label)].filter(Boolean).join(". "),
    retry: p.copy.state.retry,
    canRetry: state.retryable && ["read-error", "pass-end"].includes(state.phase) && !!state.notice,
    canRefresh: deckCanRefresh(state),
    refresh: p.copy.kit.refresh,
    back: p.copy.failure.backTo(noun(entry).plural),
  };
}

export type DeckModel = ReturnType<typeof deriveDeck>;

export type DeckCardModel = DeckModel["stack"][number];

/** deckAcceptedRow requires the command's validated row to name the record the intent reserved. */
export const deckAcceptedRow = (id: string, row: Row): boolean => row.id === id;

/** deckHeldWrite prevents a fresh intent while any stored write for this record remains unresolved. */
export function deckHeldWrite(entry: Entry, id: string, items: readonly PendingWrite[]) {
  const row = `${writePath(entry)}/${encodeURIComponent(id)}`;
  const paths = entry.commands.map((c) => commandPath(entry, c.verb, id));
  return items.find(
    (item) =>
      item.resourceKey === `${entry.module}/${entry.entity}` &&
      (item.path === row || item.path.startsWith(`${row}/`) || paths.includes(item.path)),
  );
}
