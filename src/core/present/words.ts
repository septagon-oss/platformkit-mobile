/** words: a value, a field and a noun as a person reads them. */
import { Entry, Field } from "../catalog";
import {
  policyEmptyTitle,
  policyNoun,
  policyOption,
  policyReading,
  policyTitleFields,
} from "../derivePolicy";
import { type Formatting, presentedInstant, presentedTime } from "../presentation";
import { type Copy } from "../copy";
import { proseSpoken } from "../prose";
import {
  control,
  directory,
  massNouns,
  namedBy,
  policyTitle,
  printed,
  referenceWord,
} from "../internals";
import { personValue } from "./people";
import { timeValue, values } from "../form";
import { type Row, primary, richBody } from "../record";
import { onList, rowPrimary } from "../list";

/** humanize turns a JSON name or an enum value into words: "slaDeadline" → "Sla deadline". */
export function humanize(name: string): string {
  let out = "";
  for (let i = 0; i < name.length; i++) {
    const ch = name[i]!;
    if (i === 0) out += ch.toUpperCase();
    else if (ch >= "A" && ch <= "Z") out += " " + ch.toLowerCase();
    else if (ch === "_" || ch === "-") out += " ";
    else out += ch;
  }
  return out;
}

/** plural is a screen's name for many of an entity: "task" is "tasks", "settings" is "settings". */
export function plural(noun: string): string {
  return massNouns.has(noun) || noun.endsWith("s") ? noun : noun + "s";
}

/**
 * noun is what a list header, an empty state and a row title call the resource.
 *
 * A declared `singular`/`plural` is the author's word and arrives as it was
 * written: never humanised, never re-pluralised, never re-cased. "Conteúdo" is
 * shown as "Conteúdo", and a declared plural is never made more plural. The
 * fallback is today's reading of the entity name, so for every resource that
 * declares nothing the answer is the one this build has always given.
 */
export interface Noun {
  readonly singular: string;
  readonly plural: string;
}

export function noun(e: Entry): Noun {
  return (
    policyNoun(e) ?? {
      singular: e.hints?.singular ?? humanize(e.entity),
      plural: e.hints?.plural ?? humanize(plural(e.entity)),
    }
  );
}

/**
 * nounPhrase is a resource's name as a sentence uses it: "We couldn't load
 * notes.", "No notes yet", "New note".
 *
 * A declared name keeps the case the author gave it, because case carries meaning
 * in languages this kit's English rules do not speak — the cost of not editing an
 * author's words is a capital inside an English sentence, and the sentence
 * templates are where that is absorbed. The humanised fallback is this build's
 * own reading of an entity name, which has always been said lower case.
 */
export function nounPhrase(e: Entry): Noun {
  const named = noun(e);
  if (e.resolved) return named;
  return {
    singular: e.hints?.singular ?? named.singular.toLowerCase(),
    plural: e.hints?.plural ?? named.plural.toLowerCase(),
  };
}

/**
 * hostLabel is an address reduced to what a person typed and recognises: the host,
 * with the port when it is not the scheme's own. Never the scheme, path, query,
 * fragment or credentials — a screen's title is read over a shoulder, and an
 * address bar is not the place to repeat a token. An address this cannot read is
 * no address at all, and the caller is left to name the screen another way.
 */
export function hostLabel(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  return url.port === "" ? url.hostname : `${url.hostname}:${url.port}`;
}

/** text is a value as a control reads it: the raw spelling. */
export function text(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(text).join(", ");
  return "";
}

/** Existing entry point; dates have one formatter with explicit locale and zone. */
export const timeText = presentedTime;

/**
 * Names is what one screen resolved of the records its values point at: the words
 * each is called by, keyed by the resource it lives in and the identifier stored
 * for it. An identifier never appears as a *value* in it, so no screen can reach
 * a name and find an identifier beside it, and no read that was refused leaves a
 * trace here — a name that never arrived is simply not in the map.
 */
export type Names = Readonly<Record<string, string>>;

/** nameKey is one referenced record as a key: the resource it lives in and the identifier as the wire printed it, so two resources whose identifiers collide cannot name each other. */
export const nameKey = (resource: string, id: string): string => `${resource}|${id}`;

/** points says the document calls this field's value another record: a declared target, or the picker widget that means the same thing. Nothing else is inferred to be a pointer. */
export const points = (f: Field): boolean =>
  f.hints?.reference !== undefined || f.widget === "entity-picker";

/** pointedAt is the resource a field's value points at, or nothing when the document says only that it points somewhere. */
export const pointedAt = (f: Field): string | undefined => f.hints?.reference?.resource;

/**
 * referenceWordFor is what a pointer to `resource` says when this screen holds no
 * name for it: a record of the directory of people is *assigned*, anything else
 * is *linked*. The choice is made of what the value points at and of nothing
 * else — never of whether a read answered, because a name this person was
 * refused and a name nobody could resolve are the same fact to whoever is read
 * the row, and neither is worth an error.
 */
export const referenceWordFor = (resource: string, copy: Copy): string =>
  resource === directory ? copy.kit.referenceAssigned : copy.kit.referenceLinked;

/** display is a value as a person reads it; nothing at all is a dash. */
export function display(f: Field, v: unknown, format: Formatting, names?: Names): string {
  if (f.type === "picture") return "";
  const person = personValue(f, v, format, names);
  if (person) return person.description || "—";
  const reading = policyReading(f);
  if (f.type === "bool")
    return v === true
      ? (reading?.true ?? format.copy.value.yes)
      : v === false
        ? (reading?.false ?? format.copy.value.no)
        : (reading?.missing ?? format.copy.value.notSet);
  if (f.type === "time") {
    const at = timeValue(v);
    return at ? presentedInstant(at, format).shown : text(v) || (reading?.missing ?? "—");
  }
  if ((f.type === "int" || f.type === "float") && typeof v === "number" && Number.isFinite(v))
    return new Intl.NumberFormat(format.locale, { maximumSignificantDigits: 21 }).format(v);
  const out = text(v);
  if (!out) return reading?.missing ?? "—";
  // A value that points at another record is never read back as the identifier
  // stored for it: it is the other record's name, or the one word saying there is
  // one. `names` is what this screen resolved; the word is what it could not, and
  // which word depends only on what the value points at (`referenceWord`), never
  // on whether a read answered.
  if (points(f)) return names?.[nameKey(pointedAt(f) ?? "", out)] ?? referenceWord(f, format);
  return f.enum && f.enum.length > 0 ? enumLabel(f, out) : out;
}

/**
 * label is what one record is called, named by the fields of one screen: `record`
 * is its own page, where a `detail` field answers, and `row` is a line on a list,
 * which is made of the fields `onList` admits — a field its author kept off every
 * row cannot title one either. When the screen has nothing to read, `untitled`
 * spells what the record is called instead — a noun the catalogue named and a
 * phrase the reader's own bundle holds, because a screen's title is said in the
 * phone's language and derive never asks which language that is.
 */
export function label(
  e: Entry,
  row: Row,
  untitled: Copy["kit"]["untitled"],
  where: "record" | "row" = "record",
  names?: Names,
): string {
  const titled = policyTitleFields(e, where);
  if (titled) return policyTitle(e, titled, row, names) || policyEmptyTitle(e)!;
  const at = where === "record" ? primary(e) : rowPrimary(e);
  // A record called by a pointer is called by the name of what it points at, not
  // by the identifier stored for it; with no name resolved it is untitled rather
  // than "Assigned", because the word that says a pointer exists says nothing to
  // lead a row with.
  const held =
    at === undefined
      ? ""
      : points(at)
        ? (names?.[nameKey(pointedAt(at) ?? "", text(row[at.name]))] ?? "")
        : text(row[at.name]);
  return held || untitled(noun(e).singular);
}

/** referencedName is the words a referenced record answers with, or "" when it answers none: `namedBy`'s chain and no other, so a person named by the document is named the one way, and an invited person with nothing in that field is nameless rather than called by an email address. */
export const referencedName = (target: Entry, row: Row): string =>
  label(target, row, () => "", "row");

/** fieldLabel is a field's own word for itself: what the author wrote, else its name read as words. */
export const fieldLabel = (f: Field): string =>
  f.policy?.label ?? f.hints?.label ?? humanize(f.name);

/**
 * enumLabel is one value of a closed set as a person reads it. A declared label
 * is the author's word; an unlabelled value keeps today's humanising, so a
 * document that labels two of five values loses nothing.
 */
export const enumLabel = (f: Field, value: string): string =>
  policyOption(f, value)?.label ?? f.hints?.enumLabels?.[value] ?? humanize(value);

/**
 * saidValue is a field's value as the eye reads it and as a reader says it aloud.
 * The two are the same words except twice: an instant, because a cell shows the
 * distance ("5 minutes ago") and a screen reader says the whole local date-time; and a
 * rich text body, because the record shows it in the kit's type (`Prose`) and the syntax
 * the server stored is not part of what a person is being told. No `spoken` means the
 * shown words are the whole fact, which is true of every other field type.
 */
export function saidValue(
  f: Field,
  v: unknown,
  format: Formatting,
  names?: Names,
): { readonly value: string; readonly spoken?: string } {
  const at = f.type === "time" ? timeValue(v) : undefined;
  const instant = at ? presentedInstant(at, format) : undefined;
  const body = richBody(f, v);
  const said = instant !== undefined ? instant.exact : body === undefined ? "" : proseSpoken(body);
  return {
    value: display(f, v, format, names),
    ...(said === "" ? {} : { spoken: said }),
  };
}

/**
 * hasValue says whether a field's value is a fact about this record, which is the
 * question a record asks of every field before it draws a row for it. `false` and
 * `0` are facts and get their row; nothing, an untouched blank and an empty list
 * are not. A switch nobody answered is not either, because the words it would draw
 * ("Not set") say there is no fact — which is why the bool line is its own test
 * rather than `text(v) !== ""`, which would call the string "false" an answer.
 *
 * This is the reading side of the line `values` draws for the writing side: a
 * number, a boolean and a cleared date go in the body, an untouched blank does not.
 * The two agree because both read the same `text` and the same bool spelling.
 */
export const hasValue = (f: Field, v: unknown): boolean =>
  f.type === "bool" ? v === true || v === false : text(v) !== "";
