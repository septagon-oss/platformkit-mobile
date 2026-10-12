// The outbox is a write the person made that the server never received. Its
// record shape, the states it moves through and the bounds on what may be kept
// are decided here, in plain functions; the store that holds the rows and the
// transport that sends them live in src/effects. Nothing here decides who may
// write — the server answers that again on every send — only what a held write
// has to say about itself so a phone can show it, order it and refuse it.
import { z } from "zod";
import { instantValue, presentedTime, type Formatting } from "./presentation";

/** RECORD_VERSION is the shape of one stored row; anything else is refused, never guessed at. */
export const RECORD_VERSION = 1;

/**
 * MAX_BODY bounds one held request body in UTF-16 code units — the measure of
 * what one process must later load into memory to send it. It is not a quota on
 * the person's work: a form body is orders of magnitude below it, and the
 * ceiling is checked with the same constant on the way in and on the way out.
 */
export const MAX_BODY = 262_144;

/** The five writes a phone can hold. A read needs no queue, so GET is not one of them. */
export const writeKind = z.enum(["create", "update", "replace", "delete", "command"]);
export type WriteKind = z.infer<typeof writeKind>;

/** WRITE_METHOD is how each kind reaches the server — the same five calls Api makes. */
export const WRITE_METHOD: Readonly<Record<WriteKind, "POST" | "PATCH" | "PUT" | "DELETE">> = {
  create: "POST",
  update: "PATCH",
  replace: "PUT",
  delete: "DELETE",
  command: "POST",
};

/**
 * Held states: queued is on the device and known never to have left; sending is
 * claimed by one drain; refused answered 4xx and waits for its person; unknown
 * went out and never came back, so only a person may decide what happens next.
 */
export const heldState = z.enum(["queued", "sending", "refused", "unknown"]);
export type HeldState = z.infer<typeof heldState>;

/** TRANSITIONS is the state column's whole life. Landing and Discard delete the row. */
export const TRANSITIONS: Readonly<Record<HeldState, readonly HeldState[]>> = {
  queued: ["sending"],
  sending: ["queued", "refused", "unknown"],
  refused: ["sending"],
  unknown: [],
};

export function canMove(from: HeldState, to: HeldState): boolean {
  return TRANSITIONS[from].includes(to);
}

/** claimable is what one statement may move into sending; the drain picks up queued by itself, a refused item only when the person presses Retry. */
export const claimable: readonly HeldState[] = ["queued", "refused"];

/**
 * startupState answers a row left `sending` by a death mid-send from the row
 * itself: attempt 0 means the claim happened and the request never went on a
 * wire, so it is queued again; anything above 0 means its fate is not knowable,
 * so it is unknown and only a person decides.
 */
export function startupState(attempt: number): "queued" | "unknown" {
  return attempt > 0 ? "unknown" : "queued";
}

/** Scope is whose these rows are: the selected server and the person the server named. Tenancy stays the server's, behind the session cookie. */
export interface Scope {
  readonly server: string;
  readonly userId: string;
}

/** scopeOf normalises the origin the way createApi does and refuses a scope that would hold a write nobody is signed in as. */
export function scopeOf(server: string, userId: string): Scope {
  const origin = typeof server === "string" ? server.replace(/\/+$/, "") : "";
  const person = typeof userId === "string" ? userId : "";
  if (!origin || !person) throw new RangeError("A held write needs its server and its sign-in.");
  return Object.freeze({ server: origin, userId: person });
}

export function isScope(scope: Scope | undefined): scope is Scope {
  return (
    scope !== undefined &&
    typeof scope.server === "string" &&
    scope.server.length > 0 &&
    scope.server === scope.server.replace(/\/+$/, "") &&
    typeof scope.userId === "string" &&
    scope.userId.length > 0
  );
}

/**
 * heldScope is the scope a composition hands its queue when it knows a server
 * address and a person but cannot vouch for either: it normalises the address the
 * way scopeOf does and answers nothing where scopeOf would refuse, because the
 * shell asks this on every screen rather than once at a door. A queue that gets
 * nothing holds nothing and sends nothing, which is the honest answer for an
 * address or a sign-in it cannot name.
 */
export function heldScope(server: string, userId: string): Scope | undefined {
  try {
    return scopeOf(server, userId);
  } catch {
    return undefined;
  }
}

/** Refusal is the server's own answer, decoded once by problem() in src/effects/api.ts. */
export const refusal = z.object({
  status: z.number().int(),
  detail: z.string(),
  fields: z.record(z.string(), z.string()),
});
export type Refusal = z.infer<typeof refusal>;

/** heldRecord is one row of pending_write, as its JSON text is read back. */
export const heldRecord = z.object({
  version: z.literal(RECORD_VERSION),
  id: z.string().min(1),
  kind: writeKind,
  resourceKey: z.string().min(1),
  method: z.enum(["POST", "PATCH", "PUT", "DELETE"]),
  path: z.string().startsWith("/api/v1/"),
  body: z.string().optional(),
  state: heldState,
  attempt: z.number().int().nonnegative(),
  refusal: refusal.optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

/** A PendingWrite is a held write after validation; nothing reads a raw row. */
export type PendingWrite = Readonly<z.infer<typeof heldRecord>>;

export function heldFrom(value: unknown): PendingWrite {
  return heldRecord.parse(value);
}

/** NewWrite is what a screen hands the outbox: the catalog has already resolved the address. */
export interface NewWrite {
  readonly kind: WriteKind;
  readonly resourceKey: string;
  readonly path: string;
  readonly body?: unknown;
}

/** bodyText is the exact JSON the form produced, or nothing for a bodyless request; R4's rule is api.ts's own. */
export function bodyText(body: unknown): string | undefined {
  if (body === undefined) return undefined;
  const text = JSON.stringify(body);
  if (text === undefined) throw new TypeError("The request body is not JSON.");
  return text;
}

/** bodyRefusal names why a body may not be kept, or nothing when it may. */
export function bodyRefusal(text: string | undefined): string | undefined {
  if (text !== undefined && text.length > MAX_BODY)
    return "This request is too large for this phone to keep.";
  return undefined;
}

/**
 * IDEMPOTENT_KEY is printable ASCII with no CR, LF or space: a key minted on a
 * device must not be able to ride a header as anything but one token.
 */
export const IDEMPOTENT_KEY = /^[\x21-\x7e]{1,200}$/;

export function keyRefusal(key: string): string | undefined {
  if (!IDEMPOTENT_KEY.test(key))
    return "An idempotency key is printable ASCII of at most 200 characters.";
  return undefined;
}

export function heldWrite(
  write: NewWrite,
  id: string,
  at: string,
  state: HeldState = "queued",
): PendingWrite {
  const kind = writeKind.parse(write.kind);
  const key = keyRefusal(id);
  if (key) throw new TypeError(key);
  if (write.path.startsWith("/api/v1/") === false)
    throw new TypeError("Expected an encoded API path under /api/v1/.");
  const text = bodyText(write.body);
  const tooLarge = bodyRefusal(text);
  if (tooLarge) throw new RangeError(tooLarge);
  return Object.freeze({
    version: RECORD_VERSION,
    id,
    kind,
    resourceKey: write.resourceKey,
    method: WRITE_METHOD[kind],
    path: write.path,
    ...(text === undefined ? {} : { body: text }),
    state,
    attempt: 0,
    createdAt: at,
    updatedAt: at,
  });
}

/**
 * overtakenBy answers the held write a row would cut past if it left now, or
 * nothing when nothing the queue still holds speaks about its record first. Two
 * writes to one address are statements about the same row, and the later one
 * that lands first is overwritten by the older one behind it: that is the lost
 * update the queue's order exists to prevent, so a send asks this before it
 * leaves the head. `queue` is one scope's rows in append order, which is the
 * queue's order — the clock never orders it. `behind` names the row being asked
 * about, so only the rows in front of it can be cut past; a write the phone is
 * making now sits behind everything the queue holds, so it is asked without one.
 * Only a row that could still go out later (`claimable`) can hold another back:
 * one whose fate nobody knows is never sent again by anything. A create names a
 * collection rather than a record, so two creates are statements about different
 * rows and one never overtakes the other.
 */
export function overtakenBy(
  write: Pick<NewWrite, "kind" | "path">,
  queue: readonly PendingWrite[],
  behind?: string,
): PendingWrite | undefined {
  if (write.kind === "create") return undefined;
  const at = behind === undefined ? queue.length : queue.findIndex((row) => row.id === behind);
  if (at < 0) return undefined;
  return queue
    .slice(0, at)
    .find((older) => older.path === write.path && claimable.includes(older.state));
}

/**
 * heldWriteView is what one held write says on screen: what it is, when this
 * phone last changed it, and the two acts that are the person's — send it again,
 * throw it away. The projection lives here so a row is never a second
 * implementation of a sentence. It asks only what a sentence needs — the copy
 * table and the reader's locale and place — which is what a screen already has
 * from useFeedback, so no screen assembles a Presentation to show a held write.
 */
export interface HeldWriteView {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** when names the last state change, in the words the copy table owns. */
  readonly when?: string;
  readonly retry: string;
  readonly discard: string;
  /** sending is the state in which Retry is not an offer; the write is on its way. */
  readonly busy: boolean;
}

export function heldWriteView(item: PendingWrite, p: Formatting): HeldWriteView {
  const words = p.copy.state;
  const at = instantValue(item.updatedAt);
  const said =
    item.state === "refused"
      ? { title: words.refused.title, body: item.refusal?.detail || words.refused.body }
      : item.state === "unknown"
        ? { title: words.error.title, body: words.unknownWrite }
        : { title: words.held.title, body: words.held.body };
  return Object.freeze({
    id: item.id,
    ...said,
    ...(at ? { when: words.updatedAt(presentedTime(at, p)) } : {}),
    retry: words.retry,
    discard: words.discard,
    busy: item.state === "sending",
  });
}

/** heldWrites are the rows a screen counts and lists; a write being sent is one of them. */
export function heldCount(items: readonly PendingWrite[]): number {
  return items.length;
}
