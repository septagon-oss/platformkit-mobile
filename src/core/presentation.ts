import type { Copy } from "./copy";

export type Motion = "normal" | "reduced";
export type Instant = string;

export interface Clock {
  now(): Instant;
}

export interface Presentation {
  readonly locale: string;
  readonly timeZone: string;
  readonly weekStartsOn: 1 | 7;
  readonly now: Instant;
  readonly motion: Motion;
  readonly copy: Copy;
}

/** The small part needed by existing loading/retry compatibility surfaces. */
export type Formatting = Pick<Presentation, "copy" | "locale" | "timeZone">;

export interface Feedback extends Formatting {
  readonly loadingLabel: string;
  readonly retryLabel: string;
  readonly motion: Motion;
}

export function deriveFeedback(
  copy: Copy,
  motion: Motion,
  format: Pick<Formatting, "locale" | "timeZone">,
): Feedback {
  return {
    ...format,
    copy,
    loadingLabel: copy.state.loading,
    retryLabel: copy.state.retry,
    motion,
  };
}

export type IssueCode =
  | "invalid-input"
  | "unsupported-format"
  | "unavailable"
  | "busy"
  | "validation"
  | "conflict"
  | "read-failed"
  | "offline"
  | "write-unknown"
  | "forbidden"
  | "not-found"
  | "read-only";

export interface Issue {
  readonly code: IssueCode;
  readonly path: string;
  readonly recovery: "correctable" | "immutable";
  readonly message: string;
}

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly Issue[] };

/** Strict millisecond RFC 3339; Date.parse alone normalizes invalid civil dates. */
export function instantValue(value: string): Date | undefined {
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!parts) return undefined;
  const [, y, m, d, h, min, sec, , offset] = parts;
  const year = Number(y),
    month = Number(m),
    day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1]! ||
    Number(h) > 23 ||
    Number(min) > 59 ||
    Number(sec) > 59
  )
    return undefined;
  if (offset !== "Z" && (Number(offset!.slice(1, 3)) > 23 || Number(offset!.slice(4)) > 59))
    return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export function presentationIssues(p: Presentation): readonly Issue[] {
  const issues: Issue[] = [];
  const invalid = (path: string, unsupported = false) =>
    issues.push({
      code: unsupported ? "unsupported-format" : "invalid-input",
      path,
      recovery: "immutable",
      message: unsupported ? p.copy.issue.unsupported : p.copy.issue.invalid,
    });
  try {
    if (!hasText(p.locale) || Intl.DateTimeFormat.supportedLocalesOf([p.locale]).length !== 1)
      invalid("presentation.locale", true);
  } catch {
    invalid("presentation.locale", true);
  }
  try {
    if (!hasText(p.timeZone)) throw new RangeError();
    new Intl.DateTimeFormat("en", { timeZone: p.timeZone });
  } catch {
    invalid("presentation.timeZone", true);
  }
  if (!instantValue(p.now)) invalid("presentation.now");
  if (p.weekStartsOn !== 1 && p.weekStartsOn !== 7) invalid("presentation.weekStartsOn");
  if (p.motion !== "normal" && p.motion !== "reduced") invalid("presentation.motion");
  return issues;
}

/**
 * presentedRange is one span of time in one sentence. A formatted instant names
 * its day, its clock and its zone, so a range built from two of them says the day
 * twice, says the zone twice and wraps across two lines — which is how a booking
 * slot came to read as a data dump. The day is written once (twice only when the
 * span crosses midnight), the two clock times follow, and the zone is said once.
 */
export function presentedRange(
  start: Date,
  end: Date,
  p: Pick<Presentation, "locale" | "timeZone">,
): string {
  const face = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(p.locale, { timeZone: p.timeZone, ...options });
  const day = (at: Date) => face({ month: "short", day: "numeric" }).format(at);
  const clock = (at: Date) =>
    face({ hour: "2-digit", minute: "2-digit" })
      .formatToParts(at)
      .filter((part) => part.type !== "timeZoneName")
      .map((part) => part.value)
      .join("")
      .trim();
  const offset = face({ hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
    .formatToParts(start)
    .find((part) => part.type === "timeZoneName")?.value;
  const firstDay = day(start);
  const secondDay = day(end);
  const when = firstDay === secondDay ? firstDay : `${firstDay} – ${secondDay}`;
  const hours = `${clock(start)} – ${clock(end)}`;
  return `${when} · ${hours}${offset ? ` ${offset}` : ""}`;
}

/** A formatter belongs to this explicit invocation, never to a mutable device default. */
export function presentedTime(at: Date, p: Pick<Presentation, "locale" | "timeZone">): string {
  return new Intl.DateTimeFormat(p.locale, {
    timeZone: p.timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(at);
}
