import type { Copy } from "./copy";

export type Motion = "normal" | "reduced";
export type Instant = string;

export interface Clock {
  now(): Instant;
}

export interface Presentation {
  readonly locale: string;
  readonly timeZone: string;
  /**
   * ownZone is the zone the person's own clock runs on, resolved once at the
   * boundary. It equals timeZone wherever the app reads times as the phone reads
   * them, and differs in a screen that shows a value kept in another zone. A
   * formatter decides whether to name a zone by comparing the two: a clock in the
   * reader's own zone needs no label, the way a phone never prints "local". It is
   * supplied rather than read from `resolvedOptions()` inside a formatter so that
   * every zone test decides the same sentence on any machine.
   */
  readonly ownZone: string;
  readonly weekStartsOn: 1 | 7;
  readonly now: Instant;
  readonly motion: Motion;
  readonly copy: Copy;
}

/**
 * The small part needed by existing loading/retry compatibility surfaces, and by
 * every value the person reads: `now` is what makes "5 minutes ago" computable,
 * and a formatter cannot say whether to name a zone without both spellings of it.
 */
export type Formatting = Pick<Presentation, "copy" | "locale" | "timeZone" | "ownZone" | "now">;

export interface Feedback extends Formatting {
  readonly loadingLabel: string;
  readonly retryLabel: string;
  readonly motion: Motion;
}

export function deriveFeedback(
  copy: Copy,
  motion: Motion,
  format: Pick<Formatting, "locale" | "timeZone" | "ownZone" | "now">,
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
 * span crosses midnight), the two clock times follow, and the zone is said once —
 * unless the two ends fall in different zones, which is the one span where one
 * name would be a wrong time rather than a repeated one.
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
  const zone = (at: Date) =>
    face({ hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value;
  const firstZone = zone(start);
  const lastZone = zone(end);
  const firstDay = day(start);
  const secondDay = day(end);
  const when = firstDay === secondDay ? firstDay : `${firstDay} – ${secondDay}`;
  // One zone for a span whose ends share it; the zone each end falls in when
  // they do not. A spring-forward or autumn-back shift moves the second clock
  // an hour without moving the minute, so naming only the first zone would
  // place the end an hour away from where the person's own clock reads it.
  const hours =
    firstZone && lastZone && firstZone !== lastZone
      ? `${clock(start)} ${firstZone} – ${clock(end)} ${lastZone}`
      : `${clock(start)} – ${clock(end)}${firstZone ? ` ${firstZone}` : ""}`;
  return `${when} · ${hours}`;
}

/**
 * zoneNamed says whether a spelling that prints a clock has to say which zone it
 * printed it in. A clock in the reader's own zone is the clock they live by, and a
 * label on it is a second fact rather than a useful one; a clock kept somewhere
 * else is a quotation and says so.
 */
const zoneNamed = (p: Pick<Presentation, "timeZone" | "ownZone">): boolean =>
  p.timeZone !== p.ownZone;

/** A formatter belongs to this explicit invocation, never to a mutable device default. */
export function presentedTime(
  at: Date,
  p: Pick<Presentation, "locale" | "timeZone" | "ownZone">,
): string {
  return new Intl.DateTimeFormat(p.locale, {
    timeZone: p.timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(zoneNamed(p) ? { timeZoneName: "short" as const } : {}),
  }).format(at);
}

/** The calendar parts of an instant in a zone. The parts are read, never the
 * formatted string: no locale's order for a date is one worth parsing back. */
function civilParts(
  at: Date,
  zone: string,
): {
  readonly year: number;
  readonly month: number;
  readonly day: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((candidate) => candidate.type === type)?.value ?? "0");
  return { year: part("year"), month: part("month"), day: part("day") };
}

/**
 * civilDay is the whole day an instant falls on in a zone, as days since
 * 1970-01-01 — the number two instants are compared on when a sentence needs
 * "yesterday" rather than a date.
 */
export function civilDay(at: Date, zone: string): number {
  const { year, month, day } = civilParts(at, zone);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

const MINUTE = 60_000,
  HOUR = 3_600_000;

/** A value cell is the whole sentence it prints, so a day-word from ICU begins as a sentence does. */
const sentence = (words: string): string =>
  words === "" ? words : words.charAt(0).toUpperCase() + words.slice(1);

/**
 * presentedInstant is one instant said two ways: `shown` is what the eye reads,
 * `exact` the whole local date-time a screen reader says. Two facts about one
 * instant may not disagree, so both come from this call.
 *
 * A value is read as a distance while the distance is still the answer — "Just now"
 * for a minute either side of it, "5 minutes ago" for the minute after, "Yesterday,
 * 15:12" once the clock has moved into yesterday, a plain date from a week off, when
 * nobody counts days. A counted distance is counted in the reader's calendar days,
 * never in whole 24-hour spans: a record written late on Monday is two days old on
 * Wednesday morning, however few hours have passed, and the week that ends the
 * counting is the reader's week of days. An instant that has not happened is never
 * called ago: the kit cannot know which field a deadline is, but it knows which way
 * an instant points, so a future one reads as the day it falls on — "Tomorrow, 17:00"
 * at the nearest. A spelling that prints no clock never names a zone, because a
 * duration is the same instant for every reader.
 */
/**
 * The distance words for presentedInstant. Hermes on Android has no Intl.RelativeTimeFormat: `new` on it throws
 * "undefined cannot be used as a constructor", which crashed every record screen that read a recent time (measured
 * 2026-10-09 on the API 36 emulator, phone 47ab484). Node and iOS have it, so the kit's own words stand in only where
 * it is missing, and they are the words Intl uses in each language.
 */
type DistanceUnit = "minute" | "hour" | "day";
function relativeWords(p: Formatting): (value: number, unit: DistanceUnit) => string {
  const Relative = (Intl as { RelativeTimeFormat?: typeof Intl.RelativeTimeFormat })
    .RelativeTimeFormat;
  if (typeof Relative === "function") {
    const f = new Relative(p.copy.language, { numeric: "auto" });
    return (value, unit) => f.format(value, unit);
  }
  const k = p.copy.kit;
  const n = (words: string, count: number) => words.replace("{n}", String(count));
  return (value, unit) => {
    const count = Math.abs(value);
    if (unit === "day") {
      if (value === 1) return k.tomorrow;
      if (value === -1) return k.yesterday;
      if (value === -2) return k.twoDaysAgo;
      return n(k.daysAgo, count);
    }
    if (unit === "hour") return count === 1 ? k.hourAgo : n(k.hoursAgo, count);
    return count === 1 ? k.minuteAgo : n(k.minutesAgo, count);
  };
}

export function presentedInstant(
  at: Date,
  p: Formatting,
): { readonly shown: string; readonly exact: string } {
  const exact = presentedTime(at, p);
  const now = instantValue(p.now);
  if (!now) return { shown: exact, exact };
  const face = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(p.locale, {
      timeZone: p.timeZone,
      ...options,
      ...(zoneNamed(p) ? { timeZoneName: "short" as const } : {}),
    });
  const clock = () => face({ hour: "2-digit", minute: "2-digit" }).format(at);
  const relative = { format: relativeWords(p) };
  const elapsed = now.getTime() - at.getTime();
  const today = civilDay(now, p.timeZone);
  const days = today - civilDay(at, p.timeZone);
  // The year is a fact about which year the reader is in, not about the calendar:
  // it is said only when the instant's civil year is not the reader's own.
  const dated = () =>
    face({
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      ...(civilParts(now, p.timeZone).year === civilParts(at, p.timeZone).year
        ? {}
        : { year: "numeric" }),
    }).format(at);
  // A minute either side of now is now: a server clock a little ahead of the
  // phone is no further off than one a little behind it.
  if (Math.abs(elapsed) < MINUTE) return { shown: sentence(p.copy.kit.justNow), exact };
  if (elapsed < 0) {
    if (days === 0) return { shown: sentence(clock()), exact };
    if (days === -1) return { shown: sentence(`${relative.format(1, "day")}, ${clock()}`), exact };
    return { shown: sentence(dated()), exact };
  }
  if (elapsed < HOUR)
    return { shown: sentence(relative.format(-Math.floor(elapsed / MINUTE), "minute")), exact };
  // Recency under a day is told as a duration whatever the calendar says; the day
  // word takes over only once the clock itself has moved off today.
  if (days === 0)
    return { shown: sentence(relative.format(-Math.floor(elapsed / HOUR), "hour")), exact };
  if (days === 1) return { shown: sentence(`${relative.format(-1, "day")}, ${clock()}`), exact };
  // From two days off the count is the calendar's, so the number of days a person
  // reads is the number of days the sentence's own date falls on. The week that
  // ends the counting is the reader's week of calendar days for the same reason.
  if (days < 7) return { shown: sentence(relative.format(-days, "day")), exact };
  return { shown: sentence(dated()), exact };
}
