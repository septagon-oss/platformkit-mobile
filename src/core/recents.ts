// recents.ts is the record this device remembers the person opened: the resource, the
// record, the title the phone drew for it, and the moment it was opened. What the section
// shows, and what one person's browsing may leave on a phone, is decided here; the table
// that holds it is in src/effects, and the owner is the same (server, person) pair that
// owns a held write and a cached answer — which is why a new person at the same phone
// reads an empty section without anybody deleting anything.
import { z } from "zod";
import type { Entry } from "./catalog";
import { address } from "./reentry";

/**
 * RECENT_KEEP is how many records one person's browsing may leave on the device. Five are
 * drawn; the rest are what a person reaches by going back tomorrow, and the bound is what
 * stops years of opening from growing a table nobody reads.
 */
export const RECENT_KEEP = 20;

/** RECENT_SHOWN is how many opens Home draws: the handful a person meant to come back to. */
export const RECENT_SHOWN = 5;

/**
 * recentRecord is one row of `recent_open`. `title` is the words the phone drew for the
 * record when it was on screen — never a raw field and never a word this kit invented —
 * and `openedAt` is the instant the open happened, in UTC, from the phone's own clock.
 */
export const recentRecord = z.object({
  resourceKey: z.string().min(1),
  recordId: z.string().min(1),
  title: z.string().min(1),
  openedAt: z.string().min(1),
});

export type Recent = Readonly<z.infer<typeof recentRecord>>;

export function recentFrom(value: unknown): Recent {
  return recentRecord.parse(value);
}

/**
 * recentKey identifies one remembered open, and is what a row's id and a list's key are
 * built from: the resource and the record, spelled the way the catalogue spells a resource.
 */
export const recentKey = (recent: Recent): string => `${recent.resourceKey}/${recent.recordId}`;

/**
 * RecentDoor is one remembered open together with the resource it belongs to — the row the
 * section draws. The resource comes from the catalogue the app already holds: the remembered
 * key is looked up in the caller's own catalogue, so an entry the person can no longer be
 * handed drops out of the section rather than drawing a row that opens nothing.
 */
export interface RecentDoor {
  readonly recent: Recent;
  readonly entry: Entry;
}

/** recentHref is where a remembered open goes: the record, at the address the router knows. */
export const recentHref = (door: RecentDoor): string =>
  address("detail", door.entry, door.recent.recordId);
