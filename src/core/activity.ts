// activity.ts is what the audit trail means, given only an event. The trail
// is the outbox's own record: every state change a module published, with who
// caused it and when. Nothing here names a module or a verb.
//
// The server can filter the trail by event name, by actor and by time, but not
// by record, and a payload names its record differently depending on who
// published it: the generated writes carry the row itself, so the id is `id`,
// while a command carries its own typed payload, where the id is `taskId` or
// `contentId`. So a record's activity is found by looking for its id anywhere
// in the payload, which is true of both shapes and of any module that follows
// either.
import { humanize } from "./present";
import { withCount } from "./copy";

export interface Event {
  readonly id: string;
  readonly name: string;
  readonly occurredAt: string;
  readonly actor?: string;
  readonly payload?: unknown;
}

/** about says whether an event is about this record. */
export function about(e: Event, id: string): boolean {
  if (!id) return false;
  const seen = (v: unknown): boolean => {
    if (typeof v === "string") return v === id;
    if (Array.isArray(v)) return v.some(seen);
    if (v && typeof v === "object") return Object.values(v).some(seen);
    return false;
  };
  return seen(e.payload);
}

/**
 * verb is what happened, as a person reads it: the last segment of the event's
 * name. "task.task.created" is "Created", "content.content.published" is
 * "Published". A name a module spells differently still reads as itself.
 */
export function verb(e: Event): string {
  const last = e.name.split(".").pop() ?? e.name;
  return humanize(last.replace(/_/g, " "));
}

/** subject is which module and entity an event is about, for a trail that is not about one record. */
export function subject(e: Event): string {
  const parts = e.name.split(".");
  return parts.length > 1 ? `${parts[0]}/${parts[1]}` : e.name;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * SinceWords is the kit's distance words - the same ones the phone spells a recent
 * instant with, so one count is spelled one way wherever a person meets it. They
 * arrive from the caller's copy because they are read aloud: the coarse count a
 * trail shows answers in the language the session arrived with.
 */
export interface SinceWords {
  readonly justNow: string;
  readonly minuteAgo: string;
  readonly minutesAgo: string;
  readonly hourAgo: string;
  readonly hoursAgo: string;
  readonly yesterday: string;
  readonly daysAgo: string;
}

/**
 * since is how long ago something happened, in the coarsest unit that is still
 * true. Anything older than a week is a date, because "37 days ago" is a
 * number nobody converts. `format` renders that date and `words` spells the
 * distances, both supplied by the caller: this rule names no language.
 */
export function since(at: Date, now: Date, format: (d: Date) => string, words: SinceWords): string {
  const ms = now.getTime() - at.getTime();
  if (ms < 0) return format(at);
  if (ms < MINUTE) return words.justNow;
  const counted = (one: string, many: string, count: number) =>
    count === 1 ? one : withCount(many, count);
  if (ms < HOUR) return counted(words.minuteAgo, words.minutesAgo, Math.floor(ms / MINUTE));
  if (ms < DAY) return counted(words.hourAgo, words.hoursAgo, Math.floor(ms / HOUR));
  if (ms < 7 * DAY) return counted(words.yesterday, words.daysAgo, Math.floor(ms / DAY));
  return format(at);
}
