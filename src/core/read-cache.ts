// The read cache is the last answer this phone received for one read address.
// Which answers are worth keeping, and how a stored one is read back, is
// decided here; the store that holds them is in src/effects. A cache may be
// lost — that is why an unreadable cached row is dropped where an unreadable
// held write refuses its table (src/core/outbox.ts).
import { z } from "zod";

/** CACHE_VERSION is the shape of one stored answer. */
export const CACHE_VERSION = 1;

/**
 * CACHE_KEEP is how many answers one person's browsing leaves on the device:
 * the most recent rows, so years of scrolling cannot grow without bound. A
 * screen shows one window of one list, so a page of answers is enough.
 */
export const CACHE_KEEP = 200;

export const readKind = z.enum(["page", "row"]);
export type ReadKind = z.infer<typeof readKind>;

/** cachedAnswer is one row of cached_read, keyed by (server, person, path). */
export const cachedAnswer = z.object({
  version: z.literal(CACHE_VERSION),
  kind: readKind,
  resourceKey: z.string().min(1),
  path: z.string().min(1),
  payload: z.string().min(1),
  savedAt: z.string().min(1),
});

export type CachedAnswer = Readonly<z.infer<typeof cachedAnswer>>;

export function cachedFrom(value: unknown): CachedAnswer {
  return cachedAnswer.parse(value);
}

/**
 * worthKeeping is the one rule about which response earns a row: the window a
 * screen actually shows. A further page (offset > 0) would answer for a window
 * nobody is looking at, and replacing the first page with it would mislead.
 */
export function worthKeeping(offset: number): boolean {
  return offset === 0;
}

/**
 * readAddress is the cache key of one request: the entry's own path with the
 * query the screen asked for, so a different order, filter or page size is a
 * different row and can never answer for another.
 */
export function readAddress(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}
