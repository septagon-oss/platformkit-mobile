// Failure classification turns one refusal, together with the reason the screen
// asked for it, into one sentence, one IssueCode and one thing the person may do
// next. It is pure: it names no transport, imports nothing outside src/core, and
// reads only what a `catch` arm can honestly say about what it caught.
//
// The law the whole grid follows from: a refusal the server *answered* is a fact
// about the request, so the phone may name it and offer the request again. A
// refusal that is the *absence of an answer* is a fact about nothing, so the
// phone says it could not tell, and never offers to send the same write again.
import type { Copy } from "./copy";
import type { IssueCode } from "./presentation";

/** Why the call was made — only the caller knows this, and it decides the sentence. */
export type FailureContext =
  "read" | "refresh" | "create" | "update" | "delete" | "command" | "catalog";

/** Everything a `catch` arm can say about what it caught, and nothing else. */
export interface FailureFacts {
  /** the request was abandoned because the screen left: not news at all. */
  readonly cancelled: boolean;
  /** the server answered with a status; false is a transport rejection or a deadline. */
  readonly answered: boolean;
  readonly status: number;
  /** the body could not be read by this build: a malformed document or a newer catalogue. */
  readonly unreadable: boolean;
  /** a 422's per-field refusals, which are the only server text a form may show. */
  readonly fields: Readonly<Record<string, string>>;
}

/** A read that carries no field refusals, which is every read. */
export const noFields: Readonly<Record<string, string>> = Object.freeze({});

/**
 * What a refusal's sentence names, and the one instant it quotes. Either the
 * nouns come from a catalogue entry — the server's own words — or the call
 * addressed no entry and the noun is a key into the phone's own bundle.
 */
export type FailureSubject = EntrySubject | NamedSubject;

/** A catalogue entry: `lastSeen` is the reader-formatted instant of the last good
 * read, which a refresh quotes. Without it a `refresh` is not a refresh — nothing
 * is known to quote — and is classified as a plain read.
 */
export interface EntrySubject {
  readonly singular: string;
  readonly plural: string;
  readonly command: string;
  readonly lastSeen?: string;
}

/**
 * No entry to name: a named operation reads a record, the catalogue load opens a
 * workspace. Which one is a key; the words are `Words.failure`'s, in the phone's
 * own language, because a person reads them as part of the sentence.
 */
export interface NamedSubject {
  readonly noun: "thisRecord" | "thisWorkspace";
}

export type FailureKind =
  | "cancelled"
  | "connection"
  | "unsupported"
  | "signed-out"
  | "plan"
  | "access"
  | "missing"
  | "revision"
  | "field-issues"
  | "server"
  | "refused";

/** Which of the four things the screen does with a refusal. */
export type FailureOutcome = "silent" | "notice" | "plan" | "fields";

/** The one thing the person may do next; `dismiss` and `reconcile` are named by state. */
export type FailureAction = "none" | "retry" | "back" | "dismiss" | "reconcile";

/** Whether what the screen already shows stays under this refusal. */
export type FailureKeeps = "content" | "gone";

/** A named operation carries no entry: a read of one is a read of a record. */
export const recordSubject: FailureSubject = Object.freeze({ noun: "thisRecord" });

/** The catalogue load names no resource, so its refusal names the workspace. */
export const workspaceSubject: FailureSubject = Object.freeze({ noun: "thisWorkspace" });

/** The copy key the sentence comes from; `backTo` is the label of the `back` action. */
export type FailureKey =
  | "connection"
  | "loadFailed"
  | "refreshFailed"
  | "saveFailed"
  | "deleteFailed"
  | "commandFailed"
  | "uncertain"
  | "signedOut"
  | "excluded"
  | "noAccess"
  | "gone"
  | "revision"
  | "backTo"
  | "update"
  | "loadCatalog";

/**
 * A verdict belongs to one failed call, never to a record. Nothing here is
 * stored: a verdict lives in one render, and each field is read by the layer
 * that draws it — `text` by the notice, `retains` by the hook, `fields` by the
 * form, `code` by the state it hands `deriveState`.
 */
export type FailureVerdict =
  | {
      readonly outcome: "silent";
      readonly kind: "cancelled";
      readonly fields: Readonly<Record<string, string>>;
    }
  | {
      readonly outcome: "plan";
      readonly kind: "plan";
      readonly text: string;
      readonly fields: Readonly<Record<string, string>>;
      readonly retains: FailureKeeps;
    }
  | {
      readonly outcome: "fields";
      readonly kind: "field-issues";
      readonly fields: Readonly<Record<string, string>>;
      readonly code: "validation";
      readonly action: FailureAction;
    }
  | {
      readonly outcome: "notice";
      readonly kind: FailureKind;
      readonly key: FailureKey;
      readonly text: string;
      readonly fields: Readonly<Record<string, string>>;
      readonly code: IssueCode;
      readonly action: FailureAction;
      readonly retains: FailureKeeps;
    };

// A cell is (key, code, action, keeps). Four of the twelve kinds are not cells —
// `cancelled` is silence, `plan` is not a refusal of this person's action, and a
// 422 that named a field is the fields alone — so they appear below as the two
// sentinels rather than as sentences no notice would ever draw.
type Cell =
  | {
      readonly outcome: "notice";
      readonly key: FailureKey;
      readonly code: IssueCode;
      readonly action: FailureAction;
      readonly retains: FailureKeeps;
    }
  | { readonly outcome: "plan"; readonly key: FailureKey; readonly retains: FailureKeeps }
  | { readonly outcome: "fields"; readonly action: FailureAction };
const cell = (
  key: FailureKey,
  code: IssueCode,
  action: FailureAction,
  retains: FailureKeeps,
): Cell => ({ outcome: "notice", key, code, action, retains });
const quiet = (key: FailureKey, retains: FailureKeeps): Cell => ({ outcome: "plan", key, retains });
const fieldOnly: Cell = { outcome: "fields", action: "none" };

// The grid, one row per kind, one column per context. Every (code, action) pair
// in it is a pair `deriveState` accepts: an immutable code carries `next` or
// `dismiss` and never a retry, and `write-unknown` carries only `reconcile` or
// `dismiss`. A write that was never answered keeps its content and is never
// replayed; a read that was answered withdraws.
const grid: Readonly<Record<Exclude<FailureKind, "cancelled">, Record<FailureContext, Cell>>> = {
  connection: {
    read: cell("connection", "unavailable", "retry", "gone"),
    refresh: cell("refreshFailed", "unavailable", "retry", "content"),
    create: cell("uncertain", "write-unknown", "dismiss", "content"),
    update: cell("uncertain", "write-unknown", "reconcile", "content"),
    delete: cell("uncertain", "write-unknown", "reconcile", "content"),
    command: cell("uncertain", "write-unknown", "dismiss", "content"),
    catalog: cell("connection", "unavailable", "retry", "gone"),
  },
  unsupported: {
    read: cell("update", "unsupported-format", "none", "gone"),
    refresh: cell("update", "unsupported-format", "none", "gone"),
    create: cell("uncertain", "write-unknown", "dismiss", "content"),
    update: cell("uncertain", "write-unknown", "reconcile", "content"),
    delete: cell("uncertain", "write-unknown", "reconcile", "content"),
    command: cell("uncertain", "write-unknown", "dismiss", "content"),
    catalog: cell("update", "unsupported-format", "none", "gone"),
  },
  "signed-out": {
    // T-0326 owns the action; the sentence ships without one.
    read: cell("signedOut", "unavailable", "none", "gone"),
    refresh: cell("signedOut", "unavailable", "none", "gone"),
    create: cell("signedOut", "unavailable", "none", "content"),
    update: cell("signedOut", "unavailable", "none", "content"),
    delete: cell("signedOut", "unavailable", "none", "content"),
    command: cell("signedOut", "unavailable", "none", "content"),
    catalog: cell("signedOut", "unavailable", "none", "gone"),
  },
  plan: {
    read: quiet("excluded", "gone"),
    refresh: quiet("excluded", "content"),
    create: quiet("excluded", "content"),
    update: quiet("excluded", "content"),
    delete: quiet("excluded", "content"),
    command: quiet("excluded", "content"),
    catalog: quiet("excluded", "gone"),
  },
  access: {
    read: cell("noAccess", "forbidden", "back", "gone"),
    refresh: cell("noAccess", "forbidden", "back", "gone"),
    create: cell("noAccess", "forbidden", "dismiss", "content"),
    update: cell("noAccess", "forbidden", "dismiss", "content"),
    delete: cell("noAccess", "forbidden", "dismiss", "content"),
    command: cell("noAccess", "forbidden", "dismiss", "content"),
    // The way out of an unreadable workspace is the server screen, which the
    // shell owns; `backTo` names a resource list and belongs to a record screen.
    catalog: cell("noAccess", "forbidden", "none", "gone"),
  },
  missing: {
    read: cell("gone", "not-found", "back", "gone"),
    refresh: cell("gone", "not-found", "back", "gone"),
    create: cell("gone", "not-found", "dismiss", "content"),
    update: cell("gone", "not-found", "dismiss", "content"),
    delete: cell("gone", "not-found", "dismiss", "content"),
    command: cell("gone", "not-found", "dismiss", "content"),
    catalog: cell("gone", "not-found", "none", "gone"),
  },
  revision: {
    // A GET holds no revision, so a 409 under a read is not "changed while you
    // were editing": the cell says what a read can honestly say.
    read: cell("loadFailed", "read-failed", "retry", "gone"),
    refresh: cell("refreshFailed", "read-failed", "retry", "content"),
    create: cell("revision", "conflict", "dismiss", "content"),
    update: cell("revision", "conflict", "dismiss", "content"),
    delete: cell("deleteFailed", "conflict", "retry", "content"),
    command: cell("commandFailed", "conflict", "retry", "content"),
    catalog: cell("loadCatalog", "unavailable", "retry", "gone"),
  },
  "field-issues": {
    read: cell("loadFailed", "read-failed", "retry", "gone"),
    refresh: cell("refreshFailed", "read-failed", "retry", "content"),
    create: fieldOnly,
    update: fieldOnly,
    // A read and a delete carry no fields to colour; a command sheet does.
    delete: cell("deleteFailed", "validation", "retry", "content"),
    command: fieldOnly,
    catalog: cell("loadCatalog", "unavailable", "retry", "gone"),
  },
  server: {
    read: cell("loadFailed", "read-failed", "retry", "gone"),
    refresh: cell("refreshFailed", "read-failed", "retry", "content"),
    create: cell("saveFailed", "unavailable", "retry", "content"),
    update: cell("saveFailed", "unavailable", "retry", "content"),
    delete: cell("deleteFailed", "unavailable", "retry", "content"),
    command: cell("commandFailed", "unavailable", "retry", "content"),
    catalog: cell("loadCatalog", "unavailable", "retry", "gone"),
  },
  refused: {
    read: cell("loadFailed", "read-failed", "retry", "gone"),
    refresh: cell("refreshFailed", "read-failed", "retry", "content"),
    create: cell("saveFailed", "unavailable", "retry", "content"),
    update: cell("saveFailed", "unavailable", "retry", "content"),
    delete: cell("deleteFailed", "unavailable", "retry", "content"),
    command: cell("commandFailed", "unavailable", "retry", "content"),
    catalog: cell("loadCatalog", "unavailable", "retry", "gone"),
  },
};

/** The first rule that matches. Ordered: it is the precedence, not a lookup. */
export function failureKind(facts: FailureFacts): FailureKind {
  if (facts.cancelled) return "cancelled";
  if (!facts.answered) return "connection";
  const status = facts.status;
  // A readable status outranks an unreadable body: "I could not read that" is
  // news only after "it worked".
  if (facts.unreadable && status < 400) return "unsupported";
  if (status === 401) return "signed-out";
  if (status === 402) return "plan";
  if (status === 403) return "access";
  if (status === 404) return "missing";
  if (status === 409) return "revision";
  if (status === 422 && Object.keys(facts.fields).length > 0) return "field-issues";
  if (status >= 500) return "server";
  return "refused";
}

/**
 * The verdict for one refusal. `copy` is the phone's own bundle, so the sentence
 * is the one that table holds and nowhere else; the nouns and the quoted instant
 * arrive from `subject`, which is content, never a word written here.
 */
export function classifyFailure(
  facts: FailureFacts,
  context: FailureContext,
  subject: FailureSubject,
  copy: Copy,
): FailureVerdict {
  const kind = failureKind(facts);
  if (kind === "cancelled") return { outcome: "silent", kind, fields: facts.fields };
  // A refresh that has no good read to quote is a read: there is no "last update"
  // to show, so the sentence that promises one is not available to it. A refusal
  // that names no entry never has one — no screen refreshes a named operation.
  const quotable = "noun" in subject ? undefined : subject.lastSeen;
  const at: FailureContext = context === "refresh" && !quotable ? "read" : context;
  const found = grid[kind][at];
  if (found.outcome === "fields")
    return {
      outcome: "fields",
      kind: "field-issues",
      fields: facts.fields,
      code: "validation",
      action: found.action,
    };
  const text = sentence(found.key, subject, copy);
  if (found.outcome === "plan")
    return { outcome: "plan", kind: "plan", text, fields: facts.fields, retains: found.retains };
  return {
    outcome: "notice",
    kind,
    key: found.key,
    text,
    fields: facts.fields,
    code: found.code,
    action: found.action,
    retains: found.retains,
  };
}

/** The sentence, from the phone's own bundle, with the subject's own nouns. */
function sentence(key: FailureKey, subject: FailureSubject, copy: Copy): string {
  const failure = copy.failure;
  // A subject named by the bundle fills both noun slots with the one phrase the
  // table holds for it; the entry's own nouns arrive as they were read.
  const nouns =
    "noun" in subject
      ? { singular: failure[subject.noun], plural: failure[subject.noun] }
      : { singular: subject.singular, plural: subject.plural };
  const command = "noun" in subject ? "" : subject.command;
  const quotableInstant = "noun" in subject ? "" : (subject.lastSeen ?? "");
  switch (key) {
    case "loadFailed":
      return failure.loadFailed(nouns.plural);
    case "refreshFailed":
      return failure.refreshFailed(quotableInstant);
    case "deleteFailed":
      return failure.deleteFailed(nouns.singular);
    case "commandFailed":
      return failure.commandFailed(command);
    case "revision":
      return failure.revision(nouns.singular);
    case "excluded":
      return failure.excluded(command || nouns.plural);
    case "backTo":
      return failure.backTo(nouns.plural);
    default:
      return failure[key];
  }
}

/** Whether this verdict takes the record off the screen. Silence withdraws nothing. */
export function withdraws(verdict: FailureVerdict): boolean {
  return (verdict.outcome === "notice" || verdict.outcome === "plan") && verdict.retains === "gone";
}

/**
 * The one button a refusal offers, wired to the door the screen already has.
 * Silence and the plan line offer nothing, field issues say nothing under the
 * fields they coloured, and a write nobody answered is never sent again — the
 * person either goes and looks (`reconcile`) or closes the notice (`dismiss`).
 */
export function refusalAction(
  verdict: FailureVerdict | undefined,
  copy: Copy,
  doors: {
    readonly retry: () => void;
    readonly reconcile: () => void;
    readonly dismiss: () => void;
    readonly back: () => void;
  },
  subject: FailureSubject,
): { readonly label: string; readonly onPress: () => void } | undefined {
  if (!verdict || verdict.outcome !== "notice") return undefined;
  switch (verdict.action) {
    case "retry":
      return { label: copy.state.retry, onPress: doors.retry };
    case "reconcile":
      return { label: copy.state.reconcile, onPress: doors.reconcile };
    case "dismiss":
      return { label: copy.state.dismiss, onPress: doors.dismiss };
    case "back":
      return { label: sentence("backTo", subject, copy), onPress: doors.back };
    case "none":
      return undefined;
  }
}
