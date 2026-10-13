// The read side of the file module: where one file's bytes are, which key a read of them
// is made with, and what a byte loader needs to ask for them. The pinned route table owns
// the paths — a file's row sits at its entry's own path, and `/content` is the only
// member the document gives a file's bytes — so this file invents no address and keeps no
// credential: the key stays in src/effects/api.ts, and what is handed over is one request
// a loader can make.
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
 * fileResource prepares one file's bytes for whoever will paint them: the address of the
 * content member, the key this app holds spelled out as a header (a native image loader is
 * no browser and presents no credential of its own), and the identity a loader caches on —
 * the file's own content hash, with the width this phone planned and its retry count after
 * it, so the attempt that asks again, or asks at another width, is not mistaken for the
 * attempt that was refused.
 *
 * Nothing is prepared for a read this phone cannot authorise: no file module in this
 * server's catalogue, no server or key to name means no address is asked at all, and the
 * figure says the picture is unavailable rather than asking anonymously.
 */
export function fileResource(input: {
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
  if (scope === undefined || input.entry === undefined) return undefined;
  return {
    scope: JSON.stringify([scope.server, scope.userId]),
    id: input.id,
    // The width the phone asked for belongs to the identity it caches on: the same
    // picture re-planned into a wider slot is a different set of bytes.
    version: `${input.version}#${input.width}#${input.attempt}`,
    uri: `${scope.server}${contentAddress(input.entry, input.id, input.width)}`,
    // One credential per request, spelled out because the loader is not this transport:
    // the key this connection signs with is what the bytes are asked with.
    ...(input.key === undefined ? {} : { headers: { Authorization: `Bearer ${input.key.token}` } }),
  };
}
