/** values: a field's value as a control holds it and as the wire takes it. */
import { type Language } from "../copy";
import { Entry } from "../catalog";
import { control, heldLanguage, listValues } from "../internals";
import { type Control, kind } from "./controls";
import { changedFields } from "./problems";
import { text } from "../present";
import { type Row } from "../record";

/** timeValue is the instant a field holds, or nothing when it holds nothing or nonsense. */
export function timeValue(raw: unknown): Date | undefined {
  const s = text(raw);
  if (!s) return undefined;
  const at = new Date(s);
  return Number.isNaN(at.getTime()) ? undefined : at;
}

/** timeWire is an instant as the API takes it: RFC 3339, UTC. */
export const timeWire = (at: Date): string => at.toISOString();

/** numberValue is what a typed number means, accepting a decimal comma, or nothing when it is not a number. */
export function numberValue(raw: string): number | undefined {
  const s = raw.replace(/\s/g, "");
  if (s === "") return undefined;
  const normalised = /^[-+]?\d*,\d+$/.test(s) ? s.replace(",", ".") : s;
  const n = Number(normalised);
  return Number.isFinite(n) ? n : undefined;
}

/** splitList is what a comma-separated field holds: the words, trimmed, without the blanks. */
export const splitList = (raw: string): string[] =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** joinList is the one spelling a comma-joined field knows: trimmed items, one `", "` between each. */
export const joinList = (items: readonly string[]): string =>
  items
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

/**
 * entryHoldsSeparator asks whether text a person means as ONE value holds the
 * separator. Storage is comma-joined, so one item can never carry a comma: the
 * tag box refuses the entry rather than writing one chip as two.
 *
 * The question is asked of the text, not of what splitting would leave. "alpha,"
 * splits to one word and stores none of what it spells — it asks for a second,
 * empty item and loses the comma that asked for it — so a comma *anywhere* in the
 * entry is the refusal, at either end or on its own.
 */
export const entryHoldsSeparator = (entry: string): boolean => entry.includes(",");

/**
 * valueHoldsSeparator asks whether a whole held value spells its own items.
 * A comma inside an item cannot be told from a separator by splitting — splitting
 * is what destroys it — so the question is whether the text reads back as its
 * items joined the one way storage joins them. The trailing `", "` the tag box
 * writes while a chip is pending is its own spelling and never a fault.
 */
export const valueHoldsSeparator = (raw: string): boolean =>
  raw.trim().replace(/,\s*$/, "") !== joinList(splitList(raw));

/**
 * WriteLanguage is a sheet's Save in one language: the words it carries, and the fields it
 * may not carry in the same request.
 */
export interface WriteLanguage {
  readonly locale: string;
  /** translated is every changed field this language owns. */
  readonly translated: readonly string[];
  /** other is every changed field it does not: a body cannot hold both kinds at once. */
  readonly other: readonly string[];
}

/**
 * writeLanguage is the language a sheet writes its changes in, and nothing when it writes
 * the record's own copy. A changed field that the catalogue declares translatable and the
 * server named in the language this sheet reads in holds that language's words: sending them
 * with no language would file a translation as the record's own and destroy the source, so
 * the write names the language the server named instead. Everything else — a field the server
 * named in another language, one it said nothing about, or one that is not translatable at
 * all — is the record's own copy and is written as it has always been: without a language.
 *
 * `served` is the tag the read of this row was answered in, straight off the response, and ""
 * when it named none. `heldLanguage` reads both, and a changed field whose words it puts in a
 * language the sheet's person reads is written in that language rather than bare: sent without
 * one, they would file the translation over the source it was made from.
 *
 * A language write can carry only the fields that language owns, because the record itself
 * is written without the parameter: `other` is what the sheet therefore cannot save in the
 * same breath, and the sheet says so rather than sending half of what was asked. A field the
 * catalogue does not declare translatable is always `other` — it belongs at the record's own
 * address, and this function names no language for it whatever the reading was served in.
 */
export function writeLanguage(
  row: Row | undefined,
  controls: readonly Control[],
  held: Readonly<Record<string, string>>,
  speaking: Language,
  served = "",
): WriteLanguage | undefined {
  if (row === undefined) return undefined;
  const changed = changedFields(controls, held);
  const translated: string[] = [];
  const other: string[] = [];
  let locale: string | undefined;
  for (const name of changed) {
    const field = controls.find((c) => c.field.name === name)?.field;
    const destination =
      field === undefined ? undefined : heldLanguage(row, field, speaking, served);
    if (destination === undefined) {
      other.push(name);
      continue;
    }
    // One request carries one language: a second translated field named in another language
    // is a second write, and the sheet asks for it separately rather than quietly picking one.
    if (locale !== undefined && locale !== destination) {
      other.push(name);
      continue;
    }
    if (locale === undefined) locale = destination;
    translated.push(name);
  }
  if (locale === undefined) return undefined;
  return { locale, translated, other };
}

/**
 * saveBody is the body of one Save: the values this sheet may write at the address `writing`
 * names, in that address's language.
 *
 * A language write carries only the fields that language owns. The record's own copy — `writing`
 * naming no language — carries everything else the sheet holds, except a field whose words
 * belong to a language and that nobody edited: those words came off a reading in that language,
 * and the record's address files whatever reaches it as the record's own, over the source the
 * translation was made from, which is the one write nobody can take back. A field nobody edited
 * has no new words for the record either, so it is sent nowhere and keeps what it holds.
 *
 * `speaking` and `served` are the language this sheet reads in and the tag its read was answered
 * under, the same two the language of the write is read off. A create has no reading, so nothing
 * it holds can be another language's words and every field it asks about is sent.
 */
export function saveBody(
  controls: readonly Control[],
  held: Readonly<Record<string, string>>,
  row: Row | undefined,
  writing: WriteLanguage | undefined,
  speaking: Language,
  served = "",
): Record<string, unknown> {
  const every = values(controls, held);
  if (writing !== undefined)
    return Object.fromEntries(
      Object.entries(every).filter(([name]) => writing.translated.includes(name)),
    );
  if (row === undefined) return every;
  const changed = new Set(changedFields(controls, held));
  const send: Record<string, unknown> = {};
  for (const c of controls) {
    const name = c.field.name;
    if (!(name in every)) continue;
    if (!changed.has(name) && heldLanguage(row, c.field, speaking, served) !== undefined) continue;
    send[name] = every[name];
  }
  return send;
}

/** values turns what a form holds back into what the API takes. */
export function values(
  controls: readonly Control[],
  held: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of controls) {
    // What nobody was asked to type goes back exactly as the read returned it. This
    // runs ahead of the read-only skip below because an echoed field is read-only by
    // definition: greyed on the sheet, and still a field a PUT must carry.
    if (c.echo !== undefined) {
      out[c.field.name] = c.echo;
      continue;
    }
    if (c.readOnly) continue;
    const raw = held[c.field.name] ?? c.value;
    switch (c.kind) {
      case "switch":
        out[c.field.name] = raw === "true";
        break;
      case "number": {
        const n = numberValue(raw);
        if (n !== undefined) out[c.field.name] = n;
        break;
      }
      case "list": {
        const list = listValues(c.field, raw);
        if (list !== undefined) out[c.field.name] = list;
        break;
      }
      case "datetime":
        // An optional instant that was cleared is cleared on the server too:
        // leaving it out of the body would keep what is stored.
        if (raw !== "") out[c.field.name] = raw;
        else if (!c.required) out[c.field.name] = null;
        break;
      default:
        // An untouched optional blank stays absent; clearing existing text is
        // an explicit empty value, so PATCH does not retain the saved text.
        if (
          raw !== "" ||
          c.required ||
          ((c.field.type === "string" || c.field.type === "text") && c.value !== "")
        )
          out[c.field.name] = raw;
    }
  }
  return out;
}

/**
 * writePath is where an entry's writes are answered: POST, PATCH, PUT and
 * DELETE go here, GETs go to `path`. Most resources answer both at the same
 * address and print no `write_path`; the one that does — a control plane whose
 * writes are mounted on another surface — is not something a screen or a
 * transport gets to guess at.
 */
export const writePath = (e: Entry): string => e.writePath ?? e.path;
