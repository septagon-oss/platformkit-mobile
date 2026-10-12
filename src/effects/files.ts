// The read side of the file module: where one file's bytes are, which session a read of
// them belongs to, and what a byte loader needs to ask for them. The pinned route table
// owns the paths — a file's row sits at its entry's own path, and `/content` is the only
// member the document gives a file's bytes — so this file invents no address and keeps no
// credential: the session stays in src/effects/api.ts, and what is handed over is one
// request a loader can make.
import type { Entry } from "../core/catalog";
import { heldScope } from "../core/outbox";
import { rowAddress } from "./api";
import type { ImageResource } from "./media";

/**
 * contentAddress is one file's bytes: the row's address with the content member under it.
 * It is a path, not a URL — the caller puts it on the server the session belongs to.
 */
export function contentAddress(e: Entry, id: string): string {
  return `${rowAddress(e, id)}/content`;
}

/**
 * fileResource prepares one file's bytes for whoever will paint them: the authenticated
 * address of the content member, the session this app holds as a header (a native image
 * loader is no browser and sends no cookie of its own), and the identity a loader caches
 * on — the file's own content hash, with this phone's retry count after it so the attempt
 * that asks again is not mistaken for the attempt that was refused.
 *
 * Nothing is prepared for a read this phone cannot authorise: no file module in this
 * server's catalogue, no server or session to name means no address is asked at all, and
 * the figure says the picture is unavailable rather than asking anonymously.
 */
export function fileResource(input: {
  readonly server: string;
  readonly userId: string | undefined;
  readonly entry: Entry | undefined;
  readonly id: string;
  /** version is the file's own content version (its hash), or "" when no row named one. */
  readonly version: string;
  /** attempt counts this phone's asks for this file, so a retry is a new request. */
  readonly attempt: number;
  readonly cookie: string | undefined;
}): ImageResource | undefined {
  // Whose these bytes are: the person the server named, or, until it names one, the
  // session that stands in for them. Either way a picture decoded under one session is
  // never painted under another, and a read with neither is a read not made.
  const scope = heldScope(input.server, input.userId ?? input.cookie ?? "");
  if (scope === undefined || input.entry === undefined) return undefined;
  return {
    scope: JSON.stringify([scope.server, scope.userId]),
    id: input.id,
    version: `${input.version}#${input.attempt}`,
    uri: `${scope.server}${contentAddress(input.entry, input.id)}`,
    ...(input.cookie === undefined ? {} : { headers: { Cookie: input.cookie } }),
  };
}
