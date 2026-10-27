// The saved copy: what this kit may ask the server to keep, and what one kept copy says
// about the record it was taken from. Nothing here holds a copy — the server owns the
// person's list, so the phone holds no table of it and no row of it (see the header of
// src/effects/saved.ts for why a device-local list would answer differently from the web
// for the same person). What is decided here is the contract surface: the words a source
// entry must declare before a heart may be drawn, the two bodies that move a copy, and
// the three spellings of a source's availability.
import { z } from "zod";
import type { Command, Entry, HintNotice } from "./catalog";
import type { Copy } from "./copy";
import type { Row } from "./record";
import { key } from "./catalog";

/**
 * AVAILABILITY is the whole vocabulary a source's live answer comes back in: still there,
 * gone for good, or gone while its provider is down. The three spellings are named here
 * and nowhere else in the phone, because the difference between the last two is the
 * difference between "this look no longer exists" and "the shop is shut", and a screen
 * that collapsed them would tell a person to stop wanting something they can still have.
 */
export const AVAILABILITY = ["available", "unavailable", "temporary"] as const;
export type Availability = (typeof AVAILABILITY)[number];

/** savedAvailability reads one row's availability spelling, or nothing when it is not one of the three. */
export const savedAvailability = (value: unknown): Availability | undefined =>
  AVAILABILITY.find((word) => word === value);

/** SavedRef is one source record's canonical identity as the server spells it. */
export const savedRef = z.object({
  module: z.string().min(1),
  kind: z.string().min(1),
  // The server bounds the key at 512 bytes of UTF-8; a phone cannot measure bytes of a
  // string it built from what it read, so this bounds the code units and the server,
  // which holds the real limit, refuses the rest.
  key: z.string().min(1).max(512),
});
export type SavedRef = Readonly<z.infer<typeof savedRef>>;

/**
 * saveBody is what keeping a record sends: the source's identity and the version of it
 * this phone actually saw. No snapshot, no title, no picture is ever sent — a retained
 * copy is captured by the source's own `Capture`, because a client-supplied snapshot
 * would be a copy of whatever the phone happened to have on screen.
 */
export const saveBody = z.object({
  source: savedRef,
  expectedSourceVersion: z.string(),
});
export type SaveBody = Readonly<z.infer<typeof saveBody>>;

/**
 * unsaveBody is what taking a copy away sends: the row and the revision it arrived with.
 * The revision is never incremented here — a saved copy's revision is 1 for its whole
 * life and a phone has no business guessing what another phone did to it.
 */
export const unsaveBody = z.object({
  id: z.string().min(1),
  expectedRevision: z.number().int().nonnegative(),
});
export type UnsaveBody = Readonly<z.infer<typeof unsaveBody>>;

/**
 * sourceRef names the record on screen the way the saved service names a source: the
 * module and entity the catalogue prints for it, and the id the screen was opened at.
 */
export const sourceRef = (source: Entry, id: string): SavedRef =>
  savedRef.parse({ module: source.module, kind: source.entity, key: id });

/**
 * expectedSourceVersion quotes the source's own version off the row the screen read:
 * `version`, then `revision`, and the empty string when the record prints neither. An
 * empty quote says *this phone observed no version*, which the server answers as it
 * would to any other quote it cannot match; inventing a number would be a claim about a
 * record nobody read.
 */
export const expectedSourceVersion = (row: Readonly<Record<string, unknown>>): string => {
  for (const name of ["version", "revision"]) {
    const value = row[name];
    if (typeof value === "string" && value !== "") return value;
    if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  }
  return "";
};

/**
 * SavedDeclaration is what a source entry says about being saved: the two words the heart
 * prints (to keep, already kept), the word for taking the copy away, and `listEntry`, the
 * "module/entity" of the entry that holds this person's copies. All four are required: a
 * control with no word to print, or a keep with nowhere to go, is a control that lies, and
 * each member the catalogue withholds now says for itself at its own document path.
 *
 * The kernel's `contracts.Words` carries a fifth word, `listTitle`, which is deliberately
 * not a member here: it names the page a composition owns, and this kit names every list
 * from that entry's own declared words (`presentation.plural`), so gating a heart on a word
 * no phone prints would refuse the control for a fact the screen never needed. `remove` is
 * kept because a refusal of the removal has to name the act it refused.
 *
 * The words arrive in the reader's language with the catalogue read, which is why none of
 * them lives in the kit's own table of sentences.
 */
export interface SavedDeclaration {
  readonly save: string;
  readonly saved: string;
  readonly remove: string;
  readonly listEntry: string;
}

/**
 * Savable is one source entry read against the mounted catalogue: the entry that holds
 * this person's copies, the two verbs that move a copy, and the words the author chose.
 * It is the whole of what a heart needs, and it answers nothing when any part is missing,
 * so a screen never draws a control it could not carry out.
 */
export interface Savable {
  readonly source: Entry;
  /** list is the entry that holds this person's copies of the source. */
  readonly list: Entry;
  readonly words: SavedDeclaration;
  readonly saveVerb: string;
  readonly unsaveVerb: string;
}

/**
 * SavedCopy is what one row of a person's copies adds to the row the entry already draws:
 * whether the source it was taken from is gone, and the sentence that says which kind of
 * gone. It is an addition and never a replacement — the row's own name, cells and pill are
 * `listRow`'s, asked by the screen that draws the list — because a copy's availability is
 * a fact about its source, read with the row, and nothing the phone persists.
 */
export interface SavedCopy {
  readonly muted: true;
  /** summary is the sentence that replaces the row's own line: a copy whose source went has less to say about itself than about what it no longer reaches. */
  readonly summary: string;
}

/**
 * savedCopy reads one row of a person's copies and answers what its source's live state
 * adds to it, or nothing when the source is there or the entry declares no availability
 * field at all.
 *
 * The two refusals are different sentences and are never collapsed: `unavailable` is "this
 * record has gone", `temporary` is "this provider is down", and the difference is whether
 * a person should stop wanting the thing or come back tomorrow. Neither one removes the
 * copy or its remove — a retained copy of something that went away is still the copy this
 * person kept — and neither one is inferred from a row that answers oddly.
 */
export const savedCopy = (e: Entry, row: Row, copy: Copy): SavedCopy | undefined => {
  const name = e.hints?.availabilityField;
  if (name === undefined) return undefined;
  const seen = savedAvailability(row[name]);
  if (seen === undefined || seen === "available") return undefined;
  return {
    muted: true,
    summary: seen === "unavailable" ? copy.kit.savedUnavailable : copy.kit.savedTemporary,
  };
};

/**
 * savingVerb and unsavingVerb are the two commands the saved service mounts for a
 * savable entry. They are spelled once, here, and never as an entry: nothing in the kit
 * knows which module owns the person's copies.
 */
export const savingVerb = "save";
export const unsavingVerb = "unsave";

/**
 * isKeeping says whether one command is one of the two writes that move a person's own
 * copy. They are the only two arguments a person never type — the source and the version
 * are what the screen already holds — so no record offers either as a form, a question or
 * a swipe: the heart is the one door onto the act. The pair is named by the argument each
 * one carries, never by which entry it belongs to, so a module rename costs nothing.
 */
export const isKeeping = (c: Command): boolean =>
  (c.verb === savingVerb && c.fields.some((f) => f.name === "source")) ||
  (c.verb === unsavingVerb && c.fields.some((f) => f.name === "expectedRevision"));

/**
 * savable reads one entry as a source of saved copies.
 *
 * `mounted` is the catalogue this app holds, because the declaration points at another
 * entry: a declaration naming nothing the server prints is a defect and says so at
 * `presentation.saved.listEntry`, the path the catalogue itself was read with. The saved
 * entry must offer `save` about the collection (a keep carries a source, not a row id) and
 * `unsave` about one record — the two shapes the kit's own writes take. Anything else
 * answers nothing and costs the heart alone: the entry keeps its list, its detail and every
 * other hint it declared. A caller that can reach a developer passes the notice sink; a
 * caller that cannot (a test, a read of a document it will not draw) leaves the default.
 */
export function savable(
  source: Entry,
  mounted: readonly Entry[],
  notice: HintNotice = () => {},
): Savable | undefined {
  const words = source.hints?.saved;
  if (words === undefined) return undefined;
  const at = `presentation.saved.listEntry`;
  const list = mounted.find((e) => key(e) === words.listEntry);
  if (list === undefined) {
    notice(
      at,
      `names "${words.listEntry}", which no entry of this catalogue prints: no heart is drawn`,
    );
    return undefined;
  }
  const keep = list.commands.find((c) => c.verb === savingVerb);
  if (
    keep === undefined ||
    keep.collection !== true ||
    !keep.fields.some((f) => f.name === "source")
  ) {
    notice(
      `${key(list)}.save`,
      "is not a command about the collection carrying a source: no heart is drawn",
    );
    return undefined;
  }
  const drop = list.commands.find((c) => c.verb === unsavingVerb);
  if (drop === undefined || drop.collection === true) {
    notice(`${key(list)}.unsave`, "does not run on one record: no heart is drawn");
    return undefined;
  }
  return { source, list, words, saveVerb: savingVerb, unsaveVerb: unsavingVerb };
}
