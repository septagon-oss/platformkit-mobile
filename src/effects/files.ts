// Session-bound picture addresses and loader resources. UI models carry only file IDs.
import { pictureId, type Pictures } from "../core/pictures";
import type { Entry } from "../core/catalog";
import { heldScope } from "../core/outbox";
import { rowAddress, type Bearer } from "./api";
import type { ImageResource } from "./media";

/**
 * contentAddress is one file's bytes: the row's address with the content member under it.
 * It is a path, not a URL — the caller puts it on the server the session belongs to.
 *
 * `width` is the planned width from `variantWidth`: the pin's `w` member says "serve
 * this planned width rather than the stored frame", and a number outside the file
 * module's rendered set is refused by name, so only a planned one is ever printed. Zero
 * prints no query at all, which is the bare address — the frame as stored.
 */
export function contentAddress(e: Entry, id: string, width = 0): string {
  const path = `${rowAddress(e, id)}/content`;
  return width === 0 ? path : `${path}?w=${width}`;
}

/**
 * fileResource prepares authenticated bytes from a validated picture door, or a legacy file entry.
 * Missing authorization returns nothing. Only freshly authorized public, versioned media may use
 * memory caching; callers omit `public` for unknown or cached metadata. Disk caching is never used.
 */
export function fileResource(input: {
  readonly pictures?: Pictures | undefined;
  readonly generation?: string | undefined;
  readonly public?: boolean;
  readonly server: string;
  readonly userId: string | undefined;
  readonly entry: Entry | undefined;
  readonly id: string;
  /** version is the file's own content version (its hash), or "" when no row named one. */
  readonly version: string;
  /** width is the planned served width, or 0 for the frame as stored. */
  readonly width: number;
  /** attempt counts this phone's asks for this file, so a retry is a new request. */
  readonly attempt: number;
  /** key is the key this connection signs with, or nothing where nobody is signed in. */
  readonly key: Bearer | undefined;
}): ImageResource | undefined {
  // Whose these bytes are: the person the server named, or, until it names one, the key
  // that stands in for them — its id, never its secret, so a cache identity is not a
  // credential. Either way a picture decoded under one key is never painted under
  // another, and a read with neither is a read not made.
  const scope = heldScope(input.server, input.userId ?? input.key?.id ?? "");
  if (scope === undefined || (!input.entry && !input.pictures) || !input.key) return undefined;
  if (input.pictures && (!input.userId || !pictureId(input.id))) return undefined;
  const width = input.pictures
    ? input.pictures.widths?.includes(input.width)
      ? input.width
      : 0
    : input.width;
  const path = input.pictures
    ? input.pictures.source.replace("{id}", input.id) + (width ? `?w=${width}` : "")
    : contentAddress(input.entry!, input.id, width);
  const namespace = JSON.stringify([
    scope.server,
    scope.userId,
    input.key.id,
    input.generation ?? "",
    input.pictures?.source ?? input.entry?.path,
  ]);
  const cacheKey = JSON.stringify([namespace, input.id, input.version, width, input.attempt]);
  return {
    scope: namespace,
    id: input.id,
    // The width the phone asked for belongs to the identity it caches on: the same
    // picture re-planned into a wider slot is a different set of bytes.
    version: `${input.version}#${width}#${input.attempt}`,
    uri: `${scope.server}${path}`,
    cacheKey,
    cachePolicy:
      input.public && input.version && input.generation && input.pictures && input.userId
        ? "memory"
        : "none",
    // One credential per request, spelled out because the loader is not this transport:
    // the key this connection signs with is what the bytes are asked with.
    headers: { Authorization: `Bearer ${input.key.token}` },
  };
}
