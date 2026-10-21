import { offers, type Entry } from "./catalog";
import { deckDirections, type Deck, type DeckDirection } from "./catalogDeck";
import type { Row } from "./derive";

export type DeckPhase =
  | "loading"
  | "read-error"
  | "ready"
  | "confirming"
  | "submitting"
  | "settling"
  | "held"
  | "unknown"
  | "checking"
  | "pass-end"
  | "caught-up"
  | "suspended"
  | "closed"
  | "withdrawn";
export interface DeckHistory {
  readonly id: string;
  readonly direction: DeckDirection;
  readonly kind: "command" | "skip";
}
export interface DeckIntent {
  readonly id: string;
  readonly direction: DeckDirection;
  readonly operation: number;
  readonly heldID?: string;
}
export interface DeckTransition {
  readonly kind: "choice" | "rewind" | "refusal";
  readonly direction: DeckDirection;
  readonly row: Row;
}
interface Capture {
  readonly purpose: "initial" | "revalidate";
  readonly bound?: number;
  readonly offset: number;
  readonly rows: readonly Row[];
  readonly changed: boolean;
}
export interface DeckState {
  readonly session: number;
  readonly deck: Deck;
  readonly phase: DeckPhase;
  readonly operation: number;
  readonly capture: Capture;
  readonly rows: Readonly<Record<string, Row>>;
  readonly active: readonly string[];
  readonly deferred: readonly string[];
  readonly history: readonly DeckHistory[];
  readonly blocked: readonly string[];
  readonly pending: DeckIntent | undefined;
  readonly transition: DeckTransition | undefined;
  readonly notice: string;
  readonly retryable: boolean;
  readonly changed: boolean;
  readonly encouraged: boolean;
  readonly finishPlayed: boolean;
  readonly finishing: boolean;
}

export type DeckInput =
  | {
      readonly type: "page";
      readonly operation: number;
      readonly offset: number;
      readonly items: readonly Row[];
      readonly total: number;
    }
  | { readonly type: "choose"; readonly direction: string; readonly confirmation: boolean }
  | { readonly type: "confirm" | "cancel"; readonly operation: number }
  | { readonly type: "accepted"; readonly operation: number }
  | {
      readonly type: "refused";
      readonly operation: number;
      readonly text: string;
      readonly missing: boolean;
    }
  | {
      readonly type: "held" | "unknown";
      readonly operation: number;
      readonly text: string;
      readonly heldID?: string;
    }
  | {
      readonly type: "existing";
      readonly heldID: string;
      readonly unknown: boolean;
      readonly text: string;
    }
  | { readonly type: "settled" | "finish-end"; readonly operation: number }
  | { readonly type: "rewind" | "refresh" | "retry" | "suspend" | "resume" | "close" }
  | { readonly type: "count"; readonly operation: number; readonly total: number }
  | {
      readonly type: "read-failed";
      readonly operation: number;
      readonly text: string;
      readonly retryable: boolean;
      readonly withdraw: boolean;
    };
export type DeckEvent = DeckInput & { readonly session: number };

/** reviewDeck resolves entry-level read capabilities; an unusable declaration grants no deck. */
export const reviewDeck = (entry: Entry): Deck | undefined =>
  !entry.singleton && offers(entry, "list") && offers(entry, "read")
    ? entry.hints?.deck
    : undefined;

/** startDeck begins one memory-only bounded pass. A session number scopes every later callback. */
export function startDeck(deck: Deck, session = 1): DeckState {
  return {
    session,
    deck,
    phase: "loading",
    operation: 1,
    capture: { purpose: "initial", offset: 0, rows: [], changed: false },
    rows: {},
    active: [],
    deferred: [],
    history: [],
    blocked: [],
    pending: undefined,
    transition: undefined,
    notice: "",
    retryable: true,
    changed: false,
    encouraged: false,
    finishPlayed: false,
    finishing: false,
  };
}

export const deckCanRefresh = (s: DeckState): boolean =>
  ["ready", "pass-end", "closed"].includes(s.phase);

export const deckCanRewind = (s: DeckState): boolean => {
  const last = s.history.at(-1);
  return (
    ["ready", "pass-end"].includes(s.phase) && last?.kind === "skip" && s.deferred.includes(last.id)
  );
};
export const deckChoices = (s: DeckState): readonly DeckDirection[] =>
  s.phase !== "ready" || !s.active[0]
    ? []
    : deckDirections.filter(
        (d) => s.deck.directions[d] !== undefined && !s.blocked.includes(`${s.active[0]}/${d}`),
      );

/** deckWindow advances by raw page length, bounded by the first total, before any command is enabled. */
export function deckWindow(s: DeckState, pageSize: number) {
  return {
    offset: s.capture.offset,
    limit:
      s.capture.bound === undefined
        ? pageSize
        : Math.min(pageSize, s.capture.bound - s.capture.offset),
    sort: s.deck.order,
    filters: s.deck.queue,
  };
}

function capturePage(s: DeckState, e: Extract<DeckInput, { type: "page" }>): DeckState {
  if (s.phase !== "loading" || e.offset !== s.capture.offset) return s;
  if (
    !Number.isSafeInteger(e.total) ||
    e.total < 0 ||
    e.items.some((r) => typeof r.id !== "string" || r.id.trim() === "")
  )
    throw new Error("invalid deck page");
  const bound = s.capture.bound ?? e.total;
  const remaining = Math.max(0, bound - e.offset);
  const items = e.items.slice(0, remaining);
  const seen = new Set(s.capture.rows.map((r) => r.id));
  const rows = [...s.capture.rows];
  let changed = s.capture.changed || e.total !== bound || e.items.length > remaining;
  for (const row of items) {
    if (seen.has(row.id)) changed = true;
    else {
      seen.add(row.id);
      rows.push(row);
    }
  }
  const offset = e.offset + e.items.length;
  const capture = { ...s.capture, rows, bound, offset, changed };
  if (offset < bound && e.items.length > 0) return { ...s, capture };
  changed ||= offset < bound;
  const ids = rows.map((r) => r.id as string);
  const observed = Object.fromEntries(rows.map((r) => [r.id, r]));
  const active = s.capture.purpose === "initial" ? ids : s.active.filter((id) => ids.includes(id));
  const deferred = s.deferred.filter((id) => ids.includes(id));
  changed ||=
    s.capture.purpose === "revalidate" &&
    (active.length !== s.active.length || deferred.length !== s.deferred.length);
  return {
    ...s,
    capture: { ...capture, rows: [] },
    rows: observed,
    active,
    deferred,
    blocked: [],
    notice: "",
    changed,
    phase: active.length ? "ready" : "checking",
    operation: s.operation + 1,
  };
}

function complete(s: DeckState, kind: "command" | "skip"): DeckState {
  const pending = s.pending;
  if (!pending || s.active[0] !== pending.id) return s;
  const history = [...s.history, { id: pending.id, direction: pending.direction, kind }];
  return {
    ...s,
    phase: "settling",
    active: s.active.slice(1),
    history,
    deferred: kind === "skip" ? [...s.deferred, pending.id] : s.deferred,
    transition: { kind: "choice", direction: pending.direction, row: s.rows[pending.id]! },
    pending: undefined,
    encouraged: s.encouraged || history.length >= 5,
  };
}

/** deckEvent is the only choice/settlement rule. Obsolete, duplicate and locked inputs have no effect. */
export function deckEvent(s: DeckState, e: DeckEvent): DeckState {
  if (e.session !== s.session || ("operation" in e && e.operation !== s.operation)) return s;
  if (e.type === "close")
    return { ...startDeck(s.deck, s.session + 1), phase: "closed", operation: s.operation + 1 };
  if (s.phase === "withdrawn" || (s.phase === "closed" && e.type !== "refresh")) return s;
  switch (e.type) {
    case "page":
      return capturePage(s, e);
    case "choose": {
      const direction = e.direction as DeckDirection;
      if (!deckChoices(s).includes(direction)) return s;
      const choice = s.deck.directions[direction]!;
      const operation = s.operation + 1;
      const next: DeckState = {
        ...s,
        operation,
        notice: "",
        pending: { id: s.active[0]!, direction, operation },
        phase: "skip" in choice ? "settling" : e.confirmation ? "confirming" : "submitting",
      };
      return "skip" in choice ? complete(next, "skip") : next;
    }
    case "confirm":
      return s.phase === "confirming" ? { ...s, phase: "submitting" } : s;
    case "cancel":
      return s.phase === "confirming" ? { ...s, phase: "ready", pending: undefined } : s;
    case "accepted":
      return s.phase === "submitting" ? complete(s, "command") : s;
    case "refused": {
      if (s.phase !== "submitting" || !s.pending) return s;
      const { id, direction } = s.pending;
      const blocked = e.missing ? deckDirections.map((d) => `${id}/${d}`) : [`${id}/${direction}`];
      return {
        ...s,
        phase: "settling",
        pending: undefined,
        notice: e.text,
        blocked: [...s.blocked, ...blocked],
        transition: { kind: "refusal", direction, row: s.rows[id]! },
      };
    }
    case "held":
    case "unknown":
      return s.phase === "submitting"
        ? {
            ...s,
            phase: e.type,
            notice: e.text,
            pending: s.pending
              ? { ...s.pending, ...(e.heldID ? { heldID: e.heldID } : {}) }
              : undefined,
          }
        : s;
    case "existing":
      return s.phase === "ready"
        ? {
            ...s,
            phase: e.unknown ? "unknown" : "held",
            notice: e.text,
            pending: {
              id: s.active[0]!,
              direction: "down",
              operation: s.operation,
              heldID: e.heldID,
            },
          }
        : s;
    case "settled":
      return s.phase === "settling"
        ? {
            ...s,
            phase: s.active.length ? "ready" : "checking",
            transition: undefined,
            operation: s.operation + 1,
          }
        : s;
    case "rewind": {
      if (!deckCanRewind(s)) return s;
      const last = s.history.at(-1)!;
      return {
        ...s,
        phase: "settling",
        operation: s.operation + 1,
        history: s.history.slice(0, -1),
        active: [last.id, ...s.active],
        deferred: s.deferred.filter((id) => id !== last.id),
        notice: "",
        transition: { kind: "rewind", direction: last.direction, row: s.rows[last.id]! },
      };
    }
    case "refresh":
    case "retry":
    case "resume": {
      const allowed =
        e.type === "resume"
          ? s.phase === "suspended"
          : e.type === "retry"
            ? s.retryable && ["read-error", "pass-end"].includes(s.phase)
            : deckCanRefresh(s);
      if (!allowed) return s;
      if (e.type === "retry" && s.phase === "pass-end")
        return { ...s, phase: "checking", operation: s.operation + 1, notice: "" };
      const purpose =
        s.phase === "closed"
          ? "initial"
          : s.phase === "read-error"
            ? s.capture.purpose
            : "revalidate";
      return {
        ...s,
        phase: "loading",
        operation: s.operation + 1,
        notice: "",
        capture: { purpose, offset: 0, rows: [], changed: false },
      };
    }
    case "suspend":
      return s.phase === "ready" ? { ...s, phase: "suspended", operation: s.operation + 1 } : s;
    case "count": {
      if (s.phase !== "checking") return s;
      if (!Number.isSafeInteger(e.total) || e.total < 0) throw new Error("invalid deck total");
      const finishing =
        e.total === 0 && !s.finishPlayed && s.history.some((h) => h.kind === "command");
      return {
        ...s,
        phase: e.total === 0 ? "caught-up" : "pass-end",
        finishing,
        finishPlayed: s.finishPlayed || finishing,
        notice: "",
      };
    }
    case "finish-end":
      return { ...s, finishing: false };
    case "read-failed":
      if (!["loading", "checking"].includes(s.phase)) return s;
      if (e.withdraw)
        return {
          ...startDeck(s.deck, s.session + 1),
          phase: "withdrawn",
          notice: e.text,
          retryable: false,
        };
      return {
        ...s,
        phase: s.phase === "checking" ? "pass-end" : "read-error",
        notice: e.text,
        retryable: e.retryable,
      };
  }
}
