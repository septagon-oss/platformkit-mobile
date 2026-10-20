import {
  avatar,
  avatarStack,
  filePicture,
  noMeta,
  pictureState,
  type AvatarModel,
  type FileMeta,
  type FramedPicture,
  type PictureFrame,
  compactPicture,
  entryIcon,
  pictureId,
  composedReference,
  type People,
  type Person,
  type PictureStates,
  type ResourceIcon,
  type RowMediaModel,
} from "./pictures";
// derive.ts is ADR 0007 on a phone: what a list, a detail and a form are, given
// only an entry's schema. The rules are the web generator's (ui/screens in the
// public repository), restated in one place so the two shells agree — a status
// is "Open" in a cell there and in a cell here.
import { proseSpoken } from "./prose";
import type { Command, CrudVerb, Entry, Field, HintTone } from "./catalog";
import { copyLanguage, type Copy, type Language } from "./copy";
import type { EntrySubject } from "./failure";
import type { DataCell } from "./collections";
import type { Status } from "./shared";
import {
  civilHour,
  instantValue,
  presentedInstant,
  presentedTime,
  type Formatting,
  type Presentation,
} from "./presentation";

export * from "./pictures";
export * from "./illustrations";
export { copyForLocale, copyLanguage, deriveCopy, type Copy, type Language } from "./copy";
export { stateExamples, type StateExample } from "./stateGallery";
export {
  deriveFeedback,
  instantValue,
  presentedTime,
  presentedInstant,
  civilDay,
  civilHour,
  type Clock,
  type Feedback,
  type Formatting,
  type Instant,
  type Issue,
  type IssueCode,
  type Motion,
  type Presentation,
  type Result,
} from "./presentation";
export {
  deriveState,
  deriveOffline,
  retry,
  readPhase,
  type Action,
  type Announcement,
  type SkeletonVariant,
  type StateAction,
  type StateInput,
  type StateModel,
} from "./feedback";

export type Row = Readonly<Record<string, unknown>>;

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

/**
 * massNouns are the words that are already a plural: a catalogue noun is an
 * entity name the server chose, and "content" is never made "contents" by this
 * function. The set is this kit's English share; a noun a customer invents
 * ("sla policy") is answered by the rule below, not by more English grammar here.
 */
const massNouns = new Set([
  "content",
  "settings",
  "news",
  "media",
  "data",
  "staff",
  "feedback",
  "information",
]);

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
  return {
    singular: e.hints?.singular ?? humanize(e.entity),
    plural: e.hints?.plural ?? humanize(plural(e.entity)),
  };
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
  return {
    singular: e.hints?.singular ?? named.singular.toLowerCase(),
    plural: e.hints?.plural ?? named.plural.toLowerCase(),
  };
}

/**
 * What a refusal's sentence names. The nouns are the catalogue's own — never a
 * word written into a failure rule — and `lastSeen` is the reader-formatted
 * instant of the last good read, which a refresh quotes and a first read cannot.
 */
export function failureSubject(entry: Entry, command = "", lastSeen = ""): EntrySubject {
  const named = nounPhrase(entry);
  return {
    singular: named.singular,
    plural: named.plural,
    command,
    lastSeen,
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

/** timeValue is the instant a field holds, or nothing when it holds nothing or nonsense. */
export function timeValue(raw: unknown): Date | undefined {
  const s = text(raw);
  if (!s) return undefined;
  const at = new Date(s);
  return Number.isNaN(at.getTime()) ? undefined : at;
}

/** timeWire is an instant as the API takes it: RFC 3339, UTC. */
export const timeWire = (at: Date): string => at.toISOString();

/** Existing entry point; dates have one formatter with explicit locale and zone. */
export const timeText = presentedTime;

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
 * directory is the resource whose records are the people of the workspace. It is
 * the same pair `useActivity` reads its actor names from, and it is the one
 * pointer a phone can always try to list: whether the read is allowed is the
 * server's answer, not this constant's.
 */
const directory = "user/user";

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

/**
 * referenceWord is what a pointer says when this screen holds no name for it: a
 * person is *assigned* and anything else is *linked*. The choice is made of what
 * the value points at and of nothing else — never of whether a read answered,
 * because a name this person was refused and a name nobody could resolve are the
 * same fact to the person reading the row, and neither is worth an error.
 */
function referenceWord(f: Field, format: Formatting): string {
  return pointedAt(f) === directory
    ? format.copy.kit.referenceAssigned
    : format.copy.kit.referenceLinked;
}

/** display is a value as a person reads it; nothing at all is a dash. */
export function display(f: Field, v: unknown, format: Formatting, names?: Names): string {
  if (f.type === "picture") return "";
  const person = personValue(f, v, format, names);
  if (person) return person.description || "—";
  if (f.type === "bool")
    return v === true
      ? format.copy.value.yes
      : v === false
        ? format.copy.value.no
        : format.copy.value.notSet;
  if (f.type === "time") {
    const at = timeValue(v);
    return at ? presentedInstant(at, format).shown : text(v) || "—";
  }
  if ((f.type === "int" || f.type === "float") && typeof v === "number" && Number.isFinite(v))
    return new Intl.NumberFormat(format.locale, { maximumSignificantDigits: 21 }).format(v);
  const out = text(v);
  if (!out) return "—";
  // A value that points at another record is never read back as the identifier
  // stored for it: it is the other record's name, or the one word saying there is
  // one. `names` is what this screen resolved; the word is what it could not, and
  // which word depends only on what the value points at (`referenceWord`), never
  // on whether a read answered.
  if (points(f)) return names?.[nameKey(pointedAt(f) ?? "", out)] ?? referenceWord(f, format);
  return f.enum && f.enum.length > 0 ? enumLabel(f, out) : out;
}

/**
 * nameLike are the wire names a row is recognised by before any other string:
 * the three an author reaches for when they want a record to have a title.
 */
const nameLike: readonly string[] = ["title", "name", "displayName"];

/**
 * neverShown is the one visibility no screen draws. `hidden` is integration
 * plumbing: the value stays in the schema, the JSON and the PATCH, where nothing
 * a person reads is drawn from it — so it is neither drawn nor named by anything
 * that is. The kernel says the same thing at mount (`kit/rest/hints.go`,
 * `namedFieldFault`: "a row is not named by its plumbing") and refuses the
 * document; the phone refuses the pointer and keeps the screens, because one
 * author's slip is not worth this app.
 */
const neverShown = (f: Field): boolean => f.hints?.visibility === "hidden";

/**
 * namedBy is the chain that decides what a record is called, spelled once and
 * asked of the fields the asking screen draws: the field the entry names, then a
 * field *called* title/name/displayName, then the first readable string that is
 * not a closed set of values, then nothing.
 *
 * Asking of one screen's fields is the whole of it: an identity chosen from the
 * whole schema names a row by a field that screen does not draw, and the value
 * comes back anyway through the column every row leads on. So the chain never
 * checks a visibility of its own — the list it was handed already excludes what
 * that screen keeps off.
 */
function namedBy(e: Entry, fields: readonly Field[]): Field | undefined {
  const declared = e.hints?.primaryField;
  return (
    (declared === undefined ? undefined : fields.find((f) => f.name === declared)) ??
    fields.find((f) => nameLike.includes(f.name)) ??
    fields.find((f) => f.type === "string" && !(f.enum && f.enum.length > 0))
  );
}

/**
 * primary is the field the record is recognised by: the chain over every field a
 * person is shown, `detail` included, since the record answers a `detail` field
 * and a row has no room for it. It answers `undefined` rather than fabricating an
 * `id` the schema does not hold: a record with nothing to read says so (`label`
 * below) instead of quoting an identifier nobody chose to look at.
 */
export function primary(e: Entry): Field | undefined {
  return namedBy(
    e,
    e.fields.filter((f) => !neverShown(f) && f.type !== "picture"),
  );
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
export const fieldLabel = (f: Field): string => f.hints?.label ?? humanize(f.name);

/**
 * enumLabel is one value of a closed set as a person reads it. A declared label
 * is the author's word; an unlabelled value keeps today's humanising, so a
 * document that labels two of five values loses nothing.
 */
export const enumLabel = (f: Field, value: string): string =>
  f.hints?.enumLabels?.[value] ?? humanize(value);

/**
 * enumTone is how one value of a closed set should read: which of its values is
 * good, which is a warning. Nothing is inferred — an unlabelled value is neutral
 * the way it is today — and `badgeTone` is the one cast into the colours this
 * build ships, so no atom maps a word it cannot draw.
 */
export const enumTone = (f: Field, value: string): HintTone =>
  f.hints?.enumTones?.[value] ?? "neutral";

/** badgeTone is the atom's name for a hint tone: the kernel says `success`, the kit says `ok`. */
export const badgeTone = (tone: HintTone): "ok" | "warning" | "danger" | "info" | "neutral" =>
  tone === "success" ? "ok" : tone;

/**
 * statusField is the field whose value the record's pill shows, or nothing.
 *
 * No status is ever inferred from "the first enum field": a pill that guesses
 * says something the document did not say, and a pointer at plumbing names no
 * pill either. The declaration is read here and drawn by whoever draws the pill
 * (T-0323).
 */
export const statusField = (e: Entry): Field | undefined =>
  e.hints?.statusField === undefined
    ? undefined
    : e.fields.find(
        (f) => f.name === e.hints?.statusField && f.type !== "picture" && !neverShown(f),
      );

/**
 * rowContent is a field's own answer about what a row may *say*: silence about its
 * visibility, or a declared `shown`, and the field's words may be read on a line
 * of a list — as its name, as the line under the name, or as a cell beside it.
 * `detail` and `hidden` answer no: the first is the record's own answer, which
 * `recordInformation` gives and a row has no room for, and the second is nobody's.
 *
 * A declared pointer (`previewField`, `summaryFields`) is asked the same question
 * as the default it overrides, because an entry that points a row's summary line
 * at a paragraph its own field kept for the record says two opposite things, and
 * the field's word about itself is the newer fact. `hideList` is deliberately not
 * consulted here: it declines a *column* — which is why every long text carries
 * it — and a row's line under its name is not a column. `onList` is where that
 * legacy tag is asked.
 */
const rowContent = (f: Field): boolean =>
  f.hints?.visibility === undefined || f.hints.visibility === "shown";

/**
 * onList is a field's own answer about which *columns* a list has: `rowContent`,
 * and, when the field declares no visibility, the schema's older `hideList` tag.
 * A declaration beats `hideList` in both directions (`shown` reclaims the column
 * `hideList` took, `detail` and `hidden` give up one it left), because an author's
 * word about one field is the newer fact. What else belongs in a list — never the
 * id, always the row's own name — is `listColumns`'s, not a field's.
 */
export const onList = (f: Field): boolean =>
  rowContent(f) && (f.hints?.visibility !== undefined || f.hideList !== true);

/**
 * rowFields are the fields a row is made of: what the schema puts on a list, in
 * schema order, never the id. This is the one place the list asks which fields it
 * has, so the columns it draws, the field it leads a row with and the cells beside
 * it cannot disagree about the answer.
 */
const rowFields = (e: Entry): readonly Field[] =>
  e.fields.filter((f) => f.name !== "id" && f.type !== "picture" && onList(f));

/**
 * rowPrimary is the field a list leads with and calls a row by: the same chain as
 * `primary`, asked of `rowFields` — a `detail` field is the record's answer and a
 * `hidden` one nobody's, so neither names a row. The web shell selects the same
 * way for the same reason (`ui/resource/resource.go`: `known(onList(…))`).
 */
export function rowPrimary(e: Entry): Field | undefined {
  return namedBy(e, rowFields(e));
}

/** listColumns: the field the list names rows by first, then every other field it draws; never the id. */
export function listColumns(e: Entry): readonly Field[] {
  const drawn = rowFields(e);
  const named = rowPrimary(e);
  return named === undefined ? drawn : [named, ...drawn.filter((f) => f.name !== named.name)];
}

/**
 * listCells are the few fields a row shows beneath its name. A table has a
 * header and room for every column; a row on a phone has one line, so it
 * shows what tells two records apart first: a closed set of values, then a
 * yes or no, then a number, then words, and only then the times and
 * identifiers every record has and few people scan for.
 *
 * The budget is two, whoever named the fields: one line of a phone holds two
 * values beside the line the record wrote about itself, and a third is scanned by
 * nobody, so a declared list longer than two keeps its first two. Plumbing — the
 * id and the two stamps — is never a cell whoever pointed at it: the row answers
 * those questions the same way the record does, in its `recordInformation` block.
 *
 * Neither is the declared state. `statusField`'s value is the row's *pill*, drawn
 * in the column `Row` reserves for it, and the same value is not also one of the
 * two cells beside the title: "Em aberto" as a pill and "Em aberto" as a cell
 * answers one question twice and pushes out the value that would have set this row
 * apart. This is `headerDrawn`'s rule asked of a row — a fact is drawn once, at the
 * highest place that draws it — and an entry that declares no state loses nothing:
 * with no pill to defer to, the closed set stays the plain cell it has always been.
 */
export function listCells(e: Entry, limit = 2): readonly Field[] {
  // Asked once, so the pill and the cell cannot disagree about which field the row
  // states its condition in.
  const pill = statusField(e);
  const shownTwice = (f: Field): boolean =>
    informationFields.includes(f.name) || f.name === pill?.name;
  const declared = e.hints?.summaryFields;
  if (declared !== undefined)
    // Declared means those, in the order the author gave them, minus any field a
    // row may not speak of and minus what the row draws above or beside the cells.
    // `limit` binds here too: a declaration says which values and in which order,
    // not that a phone has room for a third.
    return declared
      .flatMap((name) =>
        e.fields.filter(
          (f) => f.name === name && f.type !== "picture" && rowContent(f) && !shownTwice(f),
        ),
      )
      .slice(0, limit);
  const rank = (f: Field): number => {
    if (f.enum && f.enum.length > 0) return 0;
    if (f.type === "bool") return 1;
    if (f.type === "int" || f.type === "float") return 2;
    if (f.type === "list") return 3;
    if (f.type === "string" || f.type === "text") return 4;
    if (f.type === "time") return 5;
    return 6;
  };
  const named = rowPrimary(e);
  const preview = listPreview(e);
  return listColumns(e)
    .filter((f) => f.name !== named?.name && f.name !== preview?.name && !shownTwice(f))
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .slice(0, limit)
    .map(({ f }) => f);
}

/**
 * listPreview is the field whose line sits under a record's name, asked of one
 * medium: `row` is a line on a list, `record` is the record's own page.
 *
 * The declared pointer (`previewField`) is asked `rowContent` in both readings:
 * an author who pointed a summary line at a paragraph said what lines this record,
 * and `hideList` answers the different question of what belongs in a table column.
 * The *default* chain asks each medium its own question — `onList` for a row, the
 * one place the legacy `hideList` tag is answered, and `rowContent` for a record,
 * which has room for the paragraph a row has no room for. So an un-hinted entity's
 * long text, which every schema marks `hideList`, lines a record and not a row, and
 * a row with nothing worth reading under its name shows nothing rather than a dash.
 */
export function listPreview(e: Entry, where: "row" | "record" = "row"): Field | undefined {
  const declared = e.hints?.previewField;
  // A rich text body is never the summary line, declared or default: a printed line under
  // a name can only print the Markdown the server stored, and that syntax is not part of
  // what a person is told (`richBody`). Such a body is read by the medium that draws it —
  // the record's own reader, where a heading is a heading — which is what keeps the
  // reader on the page for an entry that hints nothing at all.
  if (declared !== undefined)
    return printed(e.fields.find((f) => f.name === declared && rowContent(f)));
  const named = rowPrimary(e);
  const speaks = where === "row" ? onList : rowContent;
  return printed(
    e.fields.find(
      (f) =>
        f.name !== named?.name &&
        speaks(f) &&
        !f.readOnly &&
        (f.type === "text" || f.widget === "textarea"),
    ),
  );
}

/** printed is a field only while a line can print its value: a rich text body has no printed form. */
function printed(f: Field | undefined): Field | undefined {
  return f !== undefined && (f.widget === "richtext" || f.type === "picture") ? undefined : f;
}

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
 * ListRow is one record as a line: what it is called, what state it is in, the
 * record's own line under its name, and the couple of values that set it apart from
 * its neighbours. It is the row a list draws and nothing else — which fields answer
 * which of the four is `rowPrimary`, `statusPill`, `listPreview(…, "row")` and
 * `listCells`'s, each asked here and nowhere else.
 *
 * An identifier is never in it. `collections.ts` names a row by `row.id` for the
 * press and the test id; a person reading "3f2a…" learns nothing, and 0085
 * photographs exactly that line.
 */
export interface ListRow {
  readonly avatar?: AvatarModel;
  readonly title: string;
  /** absent, never a dash, when the preview field holds nothing. */
  readonly summary?: string;
  /** absent when the entry declares no state: a row never guesses one. */
  readonly status?: Status;
  readonly media?: RowMediaModel;
  readonly cells: readonly DataCell[];
}

/**
 * listRow is one record read as a line. A cell exists only where the row holds a
 * value, so two chosen fields with one blank answer one cell and no placeholder;
 * each cell carries the `Field` behind it, because the molecule that draws a value
 * in the shape its type deserves (`Value`) needs the schema and not a description
 * of it — a `shape: "badge"` tag in the model would be a second `Value`.
 */
export function listRow(
  e: Entry,
  row: Row,
  format: Formatting,
  untitled: Copy["kit"]["untitled"],
  names?: Names,
  images = false,
  states: PictureStates = {},
): ListRow {
  const preview = listPreview(e, "row");
  const pill = statusPill(e, row, format);
  const media = rowMedia(e, row, images, states);
  return {
    title: label(e, row, untitled, "row", names),
    ...(`${e.module}/${e.entity}` === directory
      ? { avatar: avatar(personRecord(e, row, "row"), states, images) }
      : media.kind === "none"
        ? {}
        : { media }),
    ...(preview && hasValue(preview, row[preview.name])
      ? { summary: display(preview, row[preview.name], format, names) }
      : {}),
    ...(pill ? { status: { ...pill, symbol: "none" as const } } : {}),
    cells: listCells(e)
      .filter((field) => hasValue(field, row[field.name]))
      .map((field) => ({
        id: field.name,
        label: fieldLabel(field),
        ...saidValue(field, row[field.name], format, names),
        field,
        raw: row[field.name],
      })),
  };
}

export interface DetailItem {
  /** field is the schema entry this fact is about, as `Control.field` is. */
  readonly field: Field;
  readonly label: string;
  readonly value: string;
  /**
   * spoken is the whole fact as it is said aloud, for the one value the eye is
   * shown in shorthand: a cell reads "5 minutes ago" and a screen reader says
   * "1 Jul 2026, 13:00". Undefined wherever the shown words are the whole fact.
   */
  readonly spoken?: string;
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

/**
 * recordFields are a record's own rows: one item per field, the label the author
 * gave the field and the value read aloud the way `saidValue` reads it. It is the
 * whole of what a row on a record is made of; which rows a person is shown, and
 * above or below which line, is `recordHeader`, `recordSections` and
 * `recordInformation`.
 */
const recordField = (f: Field, v: unknown, format: Formatting, names?: Names): DetailItem => ({
  field: f,
  label: fieldLabel(f),
  ...saidValue(f, v, format, names),
});

/**
 * RecordPill is a status as a screen shows it: the author's word for the value and the
 * colour the author declared for it. Both come from one field's value through
 * `statusPill`, so a pill cannot say "Open" in green because it came first.
 */
export interface RecordPill {
  readonly label: string;
  readonly tone: "ok" | "warning" | "danger" | "info" | "neutral";
}

/**
 * statusPill is the state a record declares, as this kit draws it: the author's word
 * for the value (`enumLabels`, or the value humanised) and the colour the author
 * declared for it (`enumTones`, or neutral). It is the one reading of `statusField`
 * with its two label tables, asked by the record's header and by a list row, so a
 * record and a row cannot colour one value two ways.
 *
 * Nothing is inferred: it answers `undefined` when the entry declares no
 * `statusField`, when that field is plumbing, or when this row holds no value — a
 * pill that guessed from "the first enum field" would say something the document
 * never said (`statusField`'s own rule).
 */
export function statusPill(e: Entry, row: Row, format: Formatting): RecordPill | undefined {
  const status = statusField(e);
  if (!status || !hasValue(status, row[status.name])) return undefined;
  return {
    label: display(status, row[status.name], format),
    tone: badgeTone(enumTone(status, text(row[status.name]))),
  };
}

/**
 * finishedValues are the values of an entry's status field that mean *finished* — the subset its
 * `doneValues` hint declares, and the only thing a celebration may be asked about. It answers `[]`
 * when the entry names no `statusField`, when that field is plumbing, or when nothing was
 * declared. A tone never answers it: `enumTones` says what finished wears, not what is finished,
 * and the two tables are the kernel's own orthogonal pair.
 */
export const finishedValues = (e: Entry): readonly string[] =>
  statusField(e)?.hints?.doneValues ?? [];

/**
 * isFinished says whether this row's state is one the entry calls finished.
 *
 * The test is the row's stored value against `finishedValues`, never the pill's label: a label is
 * the author's words in the reader's language, so the same state would finish in one locale and
 * not in another. An entry declaring no done values answers false for every row, and so does a row
 * holding no status value — nothing is inferred (`statusField`'s own rule).
 */
export const isFinished = (e: Entry, row: Row): boolean => {
  const status = statusField(e);
  const done = finishedValues(e);
  return (
    done.length > 0 &&
    status !== undefined &&
    hasValue(status, row[status.name]) &&
    done.includes(text(row[status.name]))
  );
};

/**
 * finishedWord is the one sentence a record says when its state crosses into one its entry calls
 * finished: the entry's own noun, and the author's own word for the state it reached. Both words
 * are served and neither is this kit's, so the kit composes them and no screen spells the
 * sentence out a second time.
 */
export const finishedWord = (singular: string, state: string, copy: Copy): string =>
  copy.kit.finished(singular, state);

/**
 * statusTone is the colour an entry declared for this row's state, asked by a surface that draws
 * the tone of a value without its words — a mark drawn in that colour, for instance. It is
 * `statusPill`'s read and nothing new: the same declaration, the same fallback to neutral, and
 * `undefined` when the entry names no `statusField` or this row holds nothing in it.
 */
export const statusTone = (
  e: Entry,
  row: Row,
  format: Formatting,
): RecordPill["tone"] | undefined => statusPill(e, row, format)?.tone;

export interface RecordHeader {
  readonly title: string;
  /** absent when the entry declares no `statusField`, or its row holds no value: no status is ever inferred. */
  readonly status?: RecordPill;
  /** absent when the preview field has no value: a blank never prints a dash under a title. */
  readonly summary?: string;
}

/**
 * recordHeader is the top of a record: what it is called, what state it is in, and
 * the one line that tells two records apart. The three are read from the three
 * declarations the entry may carry, and from the answers its row holds, and nothing
 * else — which is why an un-hinted entry gets a title and nothing beside it.
 */
export function recordHeader(
  e: Entry,
  row: Row,
  format: Formatting,
  untitled: Copy["kit"]["untitled"],
  names?: Names,
): RecordHeader {
  const preview = listPreview(e, "record");
  const pill = statusPill(e, row, format);
  return {
    title: label(e, row, untitled, "record", names),
    ...(pill ? { status: pill } : {}),
    ...(preview && hasValue(preview, row[preview.name])
      ? { summary: display(preview, row[preview.name], format, names) }
      : {}),
  };
}

/**
 * RecordBlock is one group of a record's fields: the declared key (or "" for the
 * group that names none) and the label drawn above it.
 */
export interface RecordBlock {
  readonly key: string;
  readonly label: string;
  readonly items: readonly DetailItem[];
  /** strips are the picture galleries this block holds, drawn after its facts, in schema order. */
  readonly strips: readonly RecordStrip[];
}

/**
 * coverPicture is the field a record opens on, which `entry.hints.coverField` names.
 *
 * The catalogue's own parser already refused a name that is no visible scalar picture
 * (`picturePointer`), and `hidden` beats even this: plumbing is not a cover.
 */
export function coverPicture(e: Entry): Field | undefined {
  const name = e.hints?.coverField;
  return name === undefined
    ? undefined
    : e.fields.find((f) => f.name === name && f.type !== "picture" && !neverShown(f));
}

/**
 * galleryFields are the fields a record shows as pictures: a `list` of file identifiers
 * its author declared `present: "images"`. A field so declared over anything else is an
 * author's slip and keeps its ordinary row, because a defect must not delete data.
 */
export function galleryFields(e: Entry): readonly Field[] {
  return e.fields.filter(
    (f) =>
      f.present === "images" &&
      !neverShown(f) &&
      f.type === "list" &&
      (f.elem === "uuid" || f.elem === "string"),
  );
}

/** RecordPictures is what this phone holds of the files a record points at: each slot's load state, and the metadata read for each file. */
export interface RecordPictures {
  readonly states: PictureStates;
  readonly files: Readonly<Record<string, FileMeta>>;
}

/**
 * headerCover says whether a record opens on a picture: the entry declares a cover field
 * and this row holds a file identifier in it. It answers from the entry and the row alone,
 * so a screen can settle its header before a single byte is read.
 */
export const headerCover = (e: Entry, row: Row): boolean => {
  const field = coverPicture(e);
  return field !== undefined && pictureId(text(row[field.name]));
};

/** RecordCover is the picture a record opens on, and the field that points at it. */
export interface RecordCover {
  readonly field: Field;
  readonly id: string;
  readonly picture: FramedPicture;
}

/** RecordStrip is one gallery a record holds: its field, the block it was filed in ("" for the overview), and its pictures in declaration order. */
export interface RecordStrip {
  readonly field: Field;
  readonly block: string;
  /** count is how many pictures this gallery holds, in the reader's own digits. */
  readonly count: string;
  readonly pictures: readonly FramedPicture[];
}

/** rowId is the record's own identifier as a slot's instance needs it: "" for a row not yet stored. */
const rowId = (row: Row): string => text(row.id);

/**
 * recordCover is the picture the record opens on, or nothing at all.
 *
 * Nothing is the answer whenever the entry names no cover field, this row holds no file
 * identifier in it, or that identifier is no file: an absent picture is not a failure and
 * the header draws as it always did. Each slot's load state is keyed to this record and
 * this field, so a row shown in a list and as a record never shares one picture's state.
 */
export function recordCover(
  e: Entry,
  row: Row,
  pictures: RecordPictures,
  frame: PictureFrame,
): RecordCover | undefined {
  const field = coverPicture(e);
  const id = field === undefined ? "" : text(row[field.name]);
  if (field === undefined || !pictureId(id)) return undefined;
  const instance = JSON.stringify(["cover", `${e.module}/${e.entity}`, rowId(row), field.name]);
  return {
    field,
    id,
    picture: filePicture(
      id,
      instance,
      pictures.files[id] ?? noMeta,
      pictureState(id, instance, pictures.states),
      frame,
    ),
  };
}

/** galleryIds are the file identifiers one gallery field's row holds, in the order it holds them. */
const galleryIds = (field: Field, row: Row): readonly string[] => {
  const value = row[field.name];
  return (Array.isArray(value) ? (value as unknown[]).map(text) : splitList(text(value))).filter(
    pictureId,
  );
};

/**
 * recordPictureIds names the files a record draws: its cover and every picture its
 * galleries hold. It is what a record asks bytes for — nothing it does not draw is asked
 * for, and nothing it draws behind a disclosure is asked for early.
 */
export function recordPictureIds(e: Entry, row: Row): readonly string[] {
  const field = coverPicture(e);
  const cover = field === undefined ? "" : text(row[field.name]);
  return [
    ...(pictureId(cover) ? [cover] : []),
    ...galleryFields(e).flatMap((f) => galleryIds(f, row)),
  ];
}

/**
 * recordMedia is the galleries a record holds, each filed where the document filed its
 * field and in the order the document declared them.
 *
 * A field whose row holds no file identifier answers no strip: an empty gallery is not a
 * hole in the page. Each tile is its own slot, so two galleries on one row, or the same
 * file in a gallery and on the cover, never share a load state.
 */
export function recordMedia(
  e: Entry,
  row: Row,
  pictures: RecordPictures,
  frame: PictureFrame,
  format: Formatting,
): readonly RecordStrip[] {
  const declared = e.hints?.sections ?? [];
  return galleryFields(e).flatMap((field) => {
    const ids = galleryIds(field, row);
    if (ids.length === 0) return [];
    const slot = (index: number) =>
      JSON.stringify(["strip", `${e.module}/${e.entity}`, rowId(row), field.name, index]);
    return [
      {
        field,
        block: declared.some((section) => section.key === field.hints?.section)
          ? (field.hints?.section ?? "")
          : "",
        count: format.copy.kit.photoCount(
          new Intl.NumberFormat(format.locale).format(ids.length),
          ids.length,
        ),
        pictures: ids.map((id, index) =>
          filePicture(
            id,
            slot(index),
            pictures.files[id] ?? noMeta,
            pictureState(id, slot(index), pictures.states),
            frame,
          ),
        ),
      },
    ];
  });
}

/**
 * informationFields are the record's own three: the identifier and the two stamps.
 * Not a declaration — no document carries "this field is plumbing" — but the three
 * names every resource the kernel mounts has, and the three a person reaches for
 * when a support conversation needs them. Declaring them here, once, is what keeps
 * the id out of every other sentence about the record.
 */
export const informationFields: readonly string[] = ["id", "createdAt", "updatedAt"];

/**
 * headerDrawn names the fields a higher place draws than any block below: the ones that
 * call the record, fill its pill and give its summary line, the one its cover picture
 * points at, and every gallery of pictures it holds.
 *
 * Asking the header is the only way to get this right, because a field's own
 * visibility does not decide who draws it: `primary` reads a `detail` field (the
 * record answers a detail field and a row has no room for it) and `statusField`
 * takes any visibility but `hidden`. So the header's facts are settled here, from
 * the declarations, and every place below asks this one answer.
 */
const headerDrawn = (e: Entry): ReadonlySet<string> =>
  new Set(headerDrawnList(e).map((f) => f.name));

/**
 * headerDrawnList is the same answer as a list of fields: the declarations that fill a
 * record's header and its picture surfaces, whoever asks them.
 *
 * The cover and a gallery are here for the reason the title is: they draw their field,
 * so no block below may draw it again. A row with no cover picture is withdrawn too — a
 * file identifier printed as a row says the same fact worse (0085 principle 1), and
 * there is no other place that would draw it.
 */
const headerDrawnList = (e: Entry): readonly Field[] =>
  [
    primary(e),
    statusField(e),
    listPreview(e, "record"),
    coverPicture(e),
    ...galleryFields(e),
  ].filter((f): f is Field => f !== undefined);

/**
 * shownFields are the fields a record may draw at all: no `hidden` anywhere, and no
 * field the record's header already drew as its title, its pill or its summary line.
 *
 * That last half is the whole of "a fact is drawn once, at the highest place that
 * draws it": the field the record is named by would otherwise be the first row
 * under its own name, which is the fault 0085 photographs. It holds even when such a
 * field declares a section — a declaration says where a fact goes, not that it goes
 * twice.
 */
function shownFields(e: Entry, row: Row, keep: (f: Field) => boolean): readonly Field[] {
  const drawn = headerDrawn(e);
  return e.fields.filter(
    (f) =>
      !neverShown(f) &&
      f.type !== "picture" &&
      !drawn.has(f.name) &&
      !informationFields.includes(f.name) &&
      keep(f) &&
      hasValue(f, row[f.name]),
  );
}

/**
 * recordSections is a record's overview as data: the fields with values that are not
 * the record's plumbing, grouped as the entry declares its sections, in the order the
 * entry declared them, each block holding its fields in schema order.
 *
 * `hideList` hides nothing here — that tag is about a table being readable, not about
 * a field being secret. A field the entry filed nowhere lands in the final block,
 * which is what the catalogue's own parser calls the overview ("the field stays in
 * the overview"), and an entry that declares no sections gets exactly that one.
 * A record with nothing to say answers no blocks at all: no dash, no placeholder
 * sentence, because an empty field is not information (0085's principle 3) and the
 * "Add {field}" affordance is deferred until it has an interaction contract.
 *
 * `media` is what this phone holds of the files the record points at, and the frame a
 * picture with no stored one is drawn in. Given it, each block also answers the galleries
 * filed in it, after its facts; a block that holds nothing but a gallery is a block. With
 * no `media` the record draws facts only, which is what a screen without a picture door
 * has always drawn.
 */
export function recordSections(
  e: Entry,
  row: Row,
  format: Formatting,
  names?: Names,
  media?: { readonly pictures: RecordPictures; readonly frame: PictureFrame },
): readonly RecordBlock[] {
  const shown = shownFields(e, row, (f) => f.hints?.visibility !== "detail");
  const declared = e.hints?.sections ?? [];
  const strips = media ? recordMedia(e, row, media.pictures, media.frame, format) : [];
  const blocks: RecordBlock[] = declared.flatMap((section) => {
    const items = shown
      .filter((f) => f.hints?.section === section.key)
      .map((f) => recordField(f, row[f.name], format, names));
    const own = strips.filter((strip) => strip.block === section.key);
    return items.length === 0 && own.length === 0
      ? []
      : [{ key: section.key, label: section.label, items, strips: own }];
  });
  const rest = shown
    .filter((f) => !declared.some((section) => section.key === f.hints?.section))
    .map((f) => recordField(f, row[f.name], format, names));
  const overview = strips.filter((strip) => strip.block === "");
  return rest.length === 0 && overview.length === 0
    ? blocks
    : [...blocks, { key: "", label: format.copy.kit.overview, items: rest, strips: overview }];
}

/**
 * informationHeld are the fields the record's own block draws: the three stamps,
 * in that order, and every field the document keeps for this screen (`detail`) a
 * higher place has not already drawn. It is asked both by the block below and by
 * `pointerTargets`, so "which fields does this medium draw" stays one answer.
 */
function informationHeld(e: Entry, row: Row): readonly Field[] {
  const drawn = headerDrawn(e);
  const stamps = informationFields.flatMap((name) =>
    e.fields.filter(
      (f) => f.name === name && f.type !== "picture" && !neverShown(f) && hasValue(f, row[f.name]),
    ),
  );
  const kept = e.fields.filter(
    (f) =>
      f.hints?.visibility === "detail" &&
      !neverShown(f) &&
      f.type !== "picture" &&
      !drawn.has(f.name) &&
      !informationFields.includes(f.name) &&
      hasValue(f, row[f.name]),
  );
  return [...stamps, ...kept];
}

/**
 * Pointer is one record a value on this screen points at: the resource it lives
 * in and the identifier the row holds for it. A name is asked for by this pair
 * and nothing else, so a name can never be read across two resources whose
 * identifiers happen to match.
 */
export interface Pointer {
  readonly resource: string;
  readonly id: string;
}

/**
 * pointerTargets are the records a screen will have to name, gathered from the
 * fields that medium actually draws — so a pointer the screen never reads is
 * never asked for, and the question "which fields does this medium draw" is
 * asked of the same helpers that draw it.
 *
 * A pointer with no declared resource is not in the list: with no target named,
 * the phone has nothing to ask, and the value reads as the word rather than as
 * an identifier all the same (`display`).
 */
export function pointerTargets(
  e: Entry,
  rows: readonly Row[],
  where: "record" | "row",
): readonly Pointer[] {
  const drawn = (row: Row): readonly Field[] =>
    where === "record"
      ? [
          ...headerDrawnList(e),
          ...shownFields(e, row, (f) => f.hints?.visibility !== "detail"),
          ...informationHeld(e, row),
        ]
      : [rowPrimary(e), statusField(e), listPreview(e, "row"), ...listCells(e)].filter(
          (f): f is Field => f !== undefined,
        );
  const seen = new Set<string>();
  const out: Pointer[] = [];
  for (const row of rows) {
    for (const f of drawn(row)) {
      const resource = points(f) ? pointedAt(f) : undefined;
      if (resource === undefined) continue;
      const ids =
        f.type === "list"
          ? Array.isArray(row[f.name])
            ? (row[f.name] as unknown[]).map(text)
            : splitList(text(row[f.name]))
          : [text(row[f.name])];
      for (const id of ids) {
        if (!id || seen.has(nameKey(resource, id))) continue;
        seen.add(nameKey(resource, id));
        out.push({ resource, id });
      }
    }
  }
  return out;
}

/**
 * controlPointers are the records the greyed boxes of a sheet point at: each is
 * drawn as a name, so each is asked once. A box a person types into is not here —
 * it holds the identifier it must send and asks about nothing. The identifier is
 * read from the row and never from the control, whose own string is what the box
 * draws and may already be somebody's name.
 */
export function controlPointers(
  controls: readonly Control[],
  row: Row | undefined,
): readonly Pointer[] {
  const seen = new Set<string>();
  const out: Pointer[] = [];
  for (const c of controls) {
    const resource = c.readOnly && points(c.field) ? pointedAt(c.field) : undefined;
    const id = resource === undefined || row === undefined ? "" : text(row[c.field.name]);
    if (resource === undefined || id === "" || seen.has(nameKey(resource, id))) continue;
    seen.add(nameKey(resource, id));
    out.push({ resource, id });
  }
  return out;
}

/**
 * recordInformation is the record's plumbing a person may need: the identifier, the
 * two stamps, and every field the document keeps for this screen (`detail`) that a
 * higher place has not already drawn. The three stamps come first, in that order,
 * and only when the entry declares the field *and* the row answers it — a resource
 * that mounts no PATCH shows no "Updated at" row, which is truthful about the answer
 * the person got.
 *
 * The header's exclusion is what keeps this block the last resort it is: a record
 * named and stated by fields it keeps for itself (`visibility: detail` on the
 * primary field, a `statusField` declared `detail`) draws them in the header, and
 * `detail` is the reason a field lands *here*, not a licence to draw it a second
 * time. `hidden` beats everything here too: plumbing is not content on this screen
 * either. Whoever draws it collapses it and puts it last; this decides only what is
 * in it.
 */
export function recordInformation(
  e: Entry,
  row: Row,
  format: Formatting,
  names?: Names,
): readonly DetailItem[] {
  return informationHeld(e, row).map((f) => recordField(f, row[f.name], format, names));
}

export type ControlKind =
  "text" | "textarea" | "select" | "switch" | "number" | "datetime" | "list" | "reference";

export interface Control {
  readonly kind: ControlKind;
  readonly field: Field;
  readonly label: string;
  readonly value: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly help: string;
  readonly options: readonly { value: string; label: string }[];
  /**
   * echo is the row's own value for a field this form lets nobody type: a field
   * the author hid, or one the catalogue freezes. `writeControls` is the only
   * writer, and `values` is the only reader — it sends this back byte for byte
   * instead of coercing `value`, because a value that never entered an editor
   * should not be reshaped by one. Absent means the person can answer the field,
   * so its text is what they typed or what the row handed the box.
   */
  readonly echo?: unknown;
  /**
   * rich says the author declared this field's value a rich text body, so the sheet offers
   * the formatting controls over the box — the marks this phone's reader draws back, and
   * the picture the body may point at. Absent means the box is only a box.
   */
  readonly rich?: boolean;
}

/** kind is the control a field gets: the tag when the entity named one, the type otherwise. */
export function kind(f: Field): ControlKind {
  if ((f.enum && f.enum.length > 0) || f.widget === "select") return "select";
  if (f.widget === "textarea") return "textarea";
  // Until T-0192 brings 0069 §7's editor, a rich text body is at least written as prose: the owner met a one-line
  // box writing content (2026-10-09). The server still validates the Markdown either way.
  if (f.widget === "richtext") return "textarea";
  if (f.widget === "entity-picker") return "reference";
  switch (f.type) {
    case "bool":
      return "switch";
    case "int":
    case "float":
      return "number";
    case "time":
      return "datetime";
    case "list":
      return "list";
    default:
      return "text";
  }
}

/**
 * richBody is the Markdown a phone reads rather than prints: the body of a field whose
 * author declared `widget: richtext`, and nothing for any other field or for a value with
 * no words in it. The declaration is the catalogue's; the body is what the server stored.
 */
export function richBody(f: Field, value: unknown): string | undefined {
  if (f.widget !== "richtext") return undefined;
  const body = text(value);
  return body === "" ? undefined : body;
}

/**
 * translationNote is the sentence a record says when a field's words arrived in a language
 * other than the one its person reads in. `_i18n` is the server's own record of the
 * translatable fields it served: the language each one's words are in, and whether this
 * reader's language had a row of its own. Nothing is guessed from the text — a body that
 * reads like another language is still the body the server says it is — and a field served
 * in the language the phone asked in says nothing, because a note about the language a
 * person is reading is not information about the record.
 */
export function translationNote(f: Field, row: Row, format: Formatting): string | undefined {
  const locale = servedLanguage(row, f.name);
  if (locale === undefined) return undefined;
  const mine = copyLanguage(format.locale);
  const theirs = copyLanguage(locale);
  if (mine === theirs) return undefined;
  const kit = format.copy.kit;
  return kit.shownInLanguage(theirs === "pt" ? kit.languagePortuguese : kit.languageEnglish);
}

/**
 * servedLanguage is the language the server says one field's words arrived in. `_i18n` is
 * the response's own note of the translatable fields it served: nothing here is guessed
 * from what the text looks like, and a field the server said nothing about has no language
 * this phone can claim to know.
 */
export function servedLanguage(row: Row, name: string): string | undefined {
  const served: unknown = row._i18n;
  if (typeof served !== "object" || served === null || Array.isArray(served)) return undefined;
  const said: unknown = (served as Record<string, unknown>)[name];
  if (typeof said !== "object" || said === null || Array.isArray(said)) return undefined;
  const locale = (said as { locale?: unknown }).locale;
  return typeof locale === "string" && locale !== "" ? locale : undefined;
}

/**
 * heldLanguage is the language one field's words on a sheet belong to, and nothing when they
 * are the record's own copy. The catalogue must declare the field translatable: a field with
 * one language's words has no language to write at, however the reading was served, and the
 * server answers a field it cannot translate at a language address with a refusal that saves
 * nothing. Beyond that declaration the answer decides and never the text — the response's own
 * tag first, because a row served *in* a language shows this person that language's words
 * whichever way `_i18n` fell out: a field with no note is that language's own reviewed text,
 * which is the one field the note has nothing to say about, and a field noted as another
 * language's was shown as that language precisely so this reader could write their own. Where
 * the read named no language the note alone decides, and only when it names a language this
 * sheet's person reads: another language's note over an untagged answer is the record's own
 * copy, shown as it is.
 */
function heldLanguage(
  row: Row,
  field: Field,
  speaking: Language,
  served: string,
): string | undefined {
  if (field.translatable !== true) return undefined;
  if (served !== "") return served;
  const said = servedLanguage(row, field.name);
  return said !== undefined && copyLanguage(said) === speaking ? said : undefined;
}

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

/** control is one field as a form holds it: the same rules wherever the field came from. */
function control(f: Field, value: string, immutable: boolean): Control {
  const k = kind(f);
  // Help is the author's line for the person who fills the form, and nothing else.
  // The developer's `doc` describes a wire member to whoever wrote the server, so it
  // is never drawn or announced (0085); the two sentences the kit does owe a person —
  // what greys a value out, and what a bare identifier box takes — are the sheet's to
  // draw, because its words are the reader's language (`kitCopy`'s `changedByCommand`
  // and `identifierOnly`), and a sentence written here could only ever be English.
  // A field whose author wrote no hint therefore says nothing here, and its label,
  // its required word and its control still read.
  return {
    kind: k,
    field: f,
    // The declaration is the catalogue's; what it earns on a form is the editor's marks.
    ...(f.widget === "richtext" ? { rich: true } : {}),
    label: fieldLabel(f),
    value,
    required: f.required === true,
    readOnly: immutable,
    help: f.hints?.help ?? "",
    options: (f.enum ?? []).map((v) => ({ value: v, label: enumLabel(f, v) })),
  };
}

/**
 * formControls: one control per writable field; immutable fields are read-only on edit and absent on create.
 *
 * `names` is what this screen resolved of the records its greyed boxes point at.
 * A box nobody can type into draws that name and keeps the row's own value in
 * `echo` (added by `writeControls`), so the person reads "Assignee — Ada Lovelace"
 * and the write sends the identifier it was given. A box a person types into keeps
 * the identifier: there is no picker yet, and the value in the box is the value
 * that will be sent.
 */
export function formControls(
  e: Entry,
  row: Row | undefined,
  create: boolean,
  names?: Names,
): readonly Control[] {
  const out: Control[] = [];
  for (const f of e.fields) {
    if (f.readOnly || f.type === "picture") continue;
    // A field the author hid is plumbing: it stays in the schema, the JSON and
    // the PATCH, but not in the sheet. A *required* field is the exception —
    // taking the person's only path to a submittable create away is the write
    // this build never makes, and one ugly row is the lesser screen. The parser
    // already named the pair once.
    if (f.hints?.visibility === "hidden" && f.required !== true) continue;
    const immutable = e.immutable.includes(f.name);
    if (create && immutable) continue;
    const stored = row && f.name in row ? text(row[f.name]) : create ? (f.default ?? "") : "";
    const value =
      immutable && points(f) && names !== undefined
        ? (names[nameKey(pointedAt(f) ?? "", stored)] ?? stored)
        : stored;
    out.push(control(f, value, immutable));
  }
  return out;
}

/**
 * writeControls is the body of a whole-row replace: every field this client may write,
 * which is the sheet's own controls plus the writable ones the sheet was not shown - a
 * hidden one the author keeps as plumbing, an immutable one the row returned - each
 * carrying the value the read gave back. A PUT replaces the whole row, so a field left
 * out of the body is a field cleared by omission. Fields the catalogue itself marks
 * read-only (`id`, `createdAt`, `updatedAt`) are the server's own and never join, and a
 * field neither the read returned nor the sheet asks is not invented.
 *
 * What the person cannot type goes back as an `echo`: the row's own value, unparsed.
 * The string a control holds is an editor's spelling — a list is its items joined by
 * `", "`, a blank is an empty box — and reading a row through it and back out loses
 * whatever the spelling cannot carry: `"North, West"` as one item becomes two, `" North "`
 * and `""` lose their padding and themselves. Only what somebody typed has earned the
 * right to be re-spelled.
 */
export function writeControls(
  e: Entry,
  row: Row | undefined,
  drawn: readonly Control[],
): readonly Control[] {
  // An immutable field is drawn greyed: no keystroke can name it, so the read's own
  // value is what travels, and the control stays greyed for whoever draws it.
  const out = drawn
    .filter((c) => c.field.type !== "picture")
    .map((c) =>
      c.readOnly && row !== undefined && c.field.name in row
        ? { ...c, echo: row[c.field.name] }
        : c,
    );
  const named = new Set(out.map((c) => c.field.name));
  for (const f of e.fields) {
    if (f.readOnly || f.type === "picture" || named.has(f.name)) continue;
    if (row === undefined || !(f.name in row)) continue;
    // `value` stays the editor's spelling for the one answer the row cannot give —
    // a JSON `null` echoes nothing, and the box's own blank is what is left to send.
    out.push({ ...control(f, text(row[f.name]), false), echo: row[f.name] });
    named.add(f.name);
  }
  return out;
}

/**
 * commandControls is a command's argument as a form: the same controls a field
 * of the entity gets, because a command's argument is described the same way.
 * A command that takes no argument has none, which is what makes it a
 * confirmation rather than a sheet.
 */
export function commandControls(c: Command): readonly Control[] {
  return c.fields
    .filter((f) => f.type !== "picture")
    .map((f) => control(f, f.default ?? "", false));
}

/**
 * FormBlock is one group of a form: the declared key (or "" for the group that
 * names none), the label drawn above it ("" draws no heading), and the controls
 * in the order a person meets them.
 */
export interface FormBlock {
  readonly key: string;
  readonly label: string;
  readonly controls: readonly Control[];
}

/**
 * orderControls is the order inside a block: the field the record is called by,
 * then the required fields, then the optional ones, schema order within each.
 *
 * `identity` is the entry's own `primary` field name, and it is passed only for
 * the block that holds that field: a declaration says where a fact goes, so the
 * sheet leads a block with the name of the record but never lifts a field out of
 * the block its entry filed it in. Where an author filed the name of the record
 * in a later block, that block leads with it — and the answer to "ask for the
 * name first" is the catalogue's `sections`, not an override written here.
 */
export function orderControls(controls: readonly Control[], identity?: string): readonly Control[] {
  const rank = (c: Control) => (c.field.name === identity ? 0 : c.required ? 1 : 2);
  return controls
    .map((control, at) => ({ control, at }))
    .sort((a, b) => rank(a.control) - rank(b.control) || a.at - b.at)
    .map(({ control }) => control);
}

/**
 * formSections is the sheet as data — `recordSections`' shape for a form: the
 * fields `formControls` offers, grouped as the entry declares its sections, in
 * the order the entry declared them, each block holding its fields in the order
 * `orderControls` gives them.
 *
 * A declared block that holds no control draws nothing: an empty heading over an
 * empty card is the fault 0085 photographs. A field the entry filed nowhere lands
 * in the final block, which is named with the `overview` word the caller passes —
 * the same word the record calls that block — and an entry that declares no
 * sections at all gets exactly one block that names none, because the sheet *is*
 * the form and 0085 asks no heading on it. Which fields exist, what they hold and
 * whether they are editable stays entirely `formControls`' answer: this groups and
 * orders, and adds or removes nothing.
 */
export function formSections(
  e: Entry,
  row: Row | undefined,
  create: boolean,
  overview: string,
  names?: Names,
): readonly FormBlock[] {
  const controls = formControls(e, row, create, names);
  const identity = primary(e)?.name;
  const filed = (c: Control) => c.field.hints?.section;
  const declared = e.hints?.sections ?? [];
  const blocks: FormBlock[] = declared.flatMap((section) => {
    const own = controls.filter((c) => filed(c) === section.key);
    return own.length === 0
      ? []
      : [{ key: section.key, label: section.label, controls: orderControls(own, identity) }];
  });
  const rest = controls.filter((c) => !declared.some((s) => s.key === filed(c)));
  return rest.length === 0
    ? blocks
    : [
        ...blocks,
        {
          key: "",
          label: declared.length === 0 ? "" : overview,
          controls: orderControls(rest, identity),
        },
      ];
}

/**
 * commandSections is a command's argument as the one block it is: no identity to
 * lead with, because an argument is not a record's field, and no heading, because
 * a sheet with one group is that group alone. Required first is still worth
 * saying, so the order is the same `orderControls` the entity's own sheet uses.
 */
export function commandSections(c: Command): readonly FormBlock[] {
  return [{ key: "", label: "", controls: orderControls(commandControls(c)) }];
}

/**
 * commandTitle is what a person taps: the summary the API document gives, or
 * the verb spelled as words when it gives none.
 */
export const commandTitle = (c: Command): string => c.hints?.label || c.summary || humanize(c.verb);

/**
 * CommandWording is everything a person is told about one command, in the words
 * this build is allowed to say, assembled once for the dialog, the sheet and the
 * sentence said afterwards.
 *
 * Two rules hold across the five answers. Nothing a person reads is the
 * developer's `description`, which describes a wire member to whoever wrote the
 * server. And a fact already in the title is never repeated under it: where the
 * summary *is* the title the consequence is empty rather than the same sentence
 * twice, which leaves a command nobody described as a bare confirm — an explicit
 * question with an invented sentence about what it does is the worse screen.
 */
export interface CommandWording {
  /** title is the sheet's header and the dialog's question. */
  readonly title: string;
  /** button is the short domain word the answer is made of — never a whole sentence on a button. */
  readonly button: string;
  /** actsOn is the record the command runs on, "" when it runs on the list or the screen the dialog is drawn over. */
  readonly actsOn: string;
  /** consequence is what running it does, "" when the document says nothing. */
  readonly consequence: string;
  /** success is what the record says afterwards. */
  readonly success: string;
}

export function commandWording(c: Command, actsOn: string, copy: Copy): CommandWording {
  const title = commandTitle(c);
  const summary = c.summary ?? "";
  return {
    title,
    button: c.hints?.label ?? humanize(c.verb),
    actsOn,
    consequence: c.hints?.confirmation?.body ?? (summary !== title ? summary : ""),
    success: c.hints?.successMessage ?? copy.kit.commandDone(c.hints?.label ?? humanize(c.verb)),
  };
}

/** rowCommands are the commands about one record; collectionCommands are about the list. */
/**
 * offered excludes what the catalogue marks `system`: a command the kernel runs
 * for its own reasons is never a choice a person is given. `commandOf` and
 * `commandAt` keep resolving it, deliberately: an address someone already holds
 * still reaches it, and the kernel guards the door. Hiding the address too needs
 * a sentence in both languages, which is copy work, not a filter.
 */
export const offered = (c: Command): boolean => c.hints?.system !== true;

/** rowCommands are the commands about one record; collectionCommands are about the list. */
export const rowCommands = (e: Entry): readonly Command[] =>
  e.commands.filter((c) => !c.collection && offered(c));
export const collectionCommands = (e: Entry): readonly Command[] =>
  e.commands.filter((c) => c.collection === true && offered(c));

/**
 * CommandScope is the address a command was opened at, which is the whole of
 * what "about one record" and "about the collection" mean on screen: the
 * address either has a row to name or it does not.
 *
 * The command and the address have to agree, because the POST is derived from
 * both — `{entry.path}/{id}/{verb}`, or `{entry.path}/{verb}` when collection
 * (catalog.Command). A record command opened at the collection's address would
 * POST to the address only a collection command mounts, and a collection command
 * opened at a record's would name a row to a door that takes none. The sheet is
 * drawn from the catalog alone, so nothing else would notice until the write
 * came back 404 with the argument somebody typed still in the box.
 *
 * The test is the one `api.command` already makes of the id it is handed
 * (`id ? path/id : path`); naming it here is what lets the screen refuse before
 * anybody fills in a sheet. The two screens that *navigate* to these addresses
 * already scope themselves (`rowCommands` from a record, `collectionCommands`
 * from a list): only an address typed or deep-linked from outside can mismatch.
 */
export type CommandScope = "record" | "collection";

/** commandAt says whether a command belongs at an address; otherScope is the other one. */
export const commandAt = (c: Command, at: CommandScope): boolean =>
  at === "collection" ? c.collection === true : !c.collection;

export const otherScope = (at: CommandScope): CommandScope =>
  at === "record" ? "collection" : "record";

/** commandScope is the address a route holds: with a row in the path, a record's. */
export const commandScope = (id: string | undefined): CommandScope =>
  id ? "record" : "collection";

/** commandOf finds the command a route's verb names at the address it was opened at. */
export const commandOf = (e: Entry, verb: string, at: CommandScope): Command | undefined =>
  e.commands.find((c) => c.verb === verb && commandAt(c, at));

/**
 * RowAction is what one of an entry's rows offers a swipe: the verb, the words the
 * revealed surface and the receipt after it, and whether running it hurts.
 */
export interface RowAction {
  readonly verb: string;
  /** label is the short domain word the surface is built of — never a whole sentence. */
  readonly label: string;
  /** success is the sentence said afterwards, the same one the record would say. */
  readonly success: string;
  /** consequence is what running it does, "" when the document says nothing. */
  readonly consequence: string;
  readonly destructive: boolean;
  /** icon is the entry's own declared picture, worn in the command's tone; absent when the entry declares none this build draws. */
  readonly icon?: ResourceIcon;
}

/**
 * rowAction is the command this entry's rows may be swiped to run, resolved the way
 * a deep link resolves it, or nothing when no row of this entry swipes.
 *
 * It answers to the verb the entry declared, through the same lookup a routed sheet
 * uses, so a swipe and a typed address cannot disagree about which command a verb
 * names. Availability is all the phone is given: the command reached this session's
 * document, is not run by the kernel for its own reasons, and runs on one record.
 * Whether it runs on *this* record is the server's answer to the request, and a
 * refusal is reported there rather than guessed at here.
 */
export function rowAction(e: Entry, copy: Copy): RowAction | undefined {
  const verb = e.hints?.primaryCommand;
  if (verb === undefined) return undefined;
  const c = commandOf(e, verb, "record");
  if (c === undefined || !offered(c)) return undefined;
  const { button, success, consequence } = commandWording(c, "", copy);
  const icon = entryIcon(e);
  return {
    verb,
    label: button,
    success,
    consequence,
    destructive: c.hints?.destructive === true,
    ...(icon === undefined ? {} : { icon }),
  };
}

/** rowSwipeTone is which pair the revealed surface wears: the one that hurts, or the one that acts. */
export const rowSwipeTone = (action: RowAction): "primary" | "destructive" =>
  action.destructive ? "destructive" : "primary";

/** listValues retains the element types the server declared, or refuses the whole list. */
function listValues(field: Field, raw: string): (string | number | boolean)[] | undefined {
  const out: (string | number | boolean)[] = [];
  for (const item of splitList(raw)) {
    if (field.elem === "int" || field.elem === "float") {
      const syntax =
        field.elem === "int" ? /^[+-]?\d+$/ : /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
      if (!syntax.test(item)) return undefined;
      const n = Number(item);
      if (!Number.isFinite(n) || (field.elem === "int" && !Number.isSafeInteger(n)))
        return undefined;
      out.push(n);
    } else if (field.elem === "bool") {
      if (item !== "true" && item !== "false") return undefined;
      out.push(item === "true");
    } else out.push(item);
  }
  return out;
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
 * FormWords is the copy a form needs to refuse what it can refuse: the sentences
 * arrive from the phone's own bundle, because `derive` never asks which language
 * a person reads and a sentence written here would be a second implementation of
 * the copy table.
 */
export interface FormWords {
  /** A value whose storage is comma-joined cannot hold the separator in one item. */
  readonly commaInValue: string;
  /** A field the person owes a value for, left empty: for the boxes one types into. */
  readonly fieldRequired: (field: string) => string;
  /** The same refusal for a field whose value is chosen rather than typed. */
  readonly fieldChoiceRequired: (field: string) => string;
  /** A box that takes a number, holding something that is not one. */
  readonly fieldNumber: string;
  /** A box that takes an instant, holding something that is not one. */
  readonly fieldTime: string;
}

/**
 * problems is what a form can refuse before the server does: a required field left
 * empty, a number that is not one, an instant that is not one, a comma-joined value
 * that does not spell its own items. Everything else - ranges, units, uniqueness,
 * permission - is the server's, answered in the same shape, so a form shows both the
 * same way. Each answer is a sentence naming what to mend, and the sheet runs this on
 * submit, which is what lets it ask for the first field that needs mending.
 */
export function problems(
  controls: readonly Control[],
  held: Readonly<Record<string, string>>,
  words: FormWords,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const c of controls) {
    if (c.readOnly) continue;
    const raw = held[c.field.name] ?? c.value;
    if (raw === "") {
      // An empty field is a refusal only where the person owes one - and never for a
      // switch, which answers for itself (values reads "" as off), nor for an
      // immutable value nobody may fill, which the line above already passed by.
      if (c.required && c.kind !== "switch")
        out[c.field.name] =
          c.kind === "select" || c.kind === "datetime"
            ? words.fieldChoiceRequired(c.label)
            : words.fieldRequired(c.label);
      continue;
    }
    if (c.kind === "number" && numberValue(raw) === undefined)
      out[c.field.name] = words.fieldNumber;
    if (c.kind === "datetime" && timeValue(raw) === undefined) out[c.field.name] = words.fieldTime;
    // The comma is refused on its own, ahead of the item type: a value spelled
    // `1,2` is two integers read out of one item, and the sentence a person can
    // act on is about the comma, not about a type nobody wrote wrong.
    if (c.kind === "list" && valueHoldsSeparator(raw)) out[c.field.name] = words.commaInValue;
    else if (c.kind === "list" && listValues(c.field, raw) === undefined)
      out[c.field.name] = "contains a value that does not match its item type";
  }
  return out;
}

/**
 * sameAnswer is whether a control holds what it arrived with. For most controls one
 * answer has one spelling, so the strings settle it. Two do not:
 *  - an instant, because the date row writes `timeWire`, which always carries
 *    milliseconds, while the server spells the same instant without them
 *    ("2026-07-18T09:00:00Z" beside "2026-07-18T09:00:00.000Z"), and because a value
 *    neither side can read is not an answer at all - `problems` refuses it, and a
 *    refusal is worth asking about;
 *  - a switch, because `values` reads anything but "true" as off, so an absent value
 *    and an explicit "false" are the same answer.
 * Both are the sheet's own question - is there anything here a person would miss?
 */
function sameAnswer(c: Control, typed: string): boolean {
  if (typed === c.value) return true;
  if (c.kind === "switch") return (typed === "true") === (c.value === "true");
  if (c.kind !== "datetime") return false;
  const now = timeValue(typed);
  const then = timeValue(c.value);
  return now !== undefined && then !== undefined && now.getTime() === then.getTime();
}

/**
 * changedFields names the controls, in asked order, whose effective value differs
 * from the one the row arrived with: changed, not merely touched. `held` is what a
 * person typed and `Control.value` what the read returned (or the declared default on a
 * create), so retyping the same text, re-picking the same instant or toggling a switch
 * back is no change - and a person who changed nothing is never asked whether they
 * meant to throw it away. Comparison is on what a control means, which is why a
 * switch's "true", a number's "3", a row's own instant and `timeWire`'s spelling of it
 * all match their own row. See `sameAnswer` for the two that do not spell one answer
 * one way.
 */
export function changedFields(
  controls: readonly Control[],
  held: Readonly<Record<string, string>>,
): readonly string[] {
  const out: string[] = [];
  for (const c of controls)
    if (c.field.name in held && !sameAnswer(c, held[c.field.name]!)) out.push(c.field.name);
  return out;
}

/**
 * firstProblem is the field a sheet asks for first: the earliest control in the sheet's
 * own asked order that carries a sentence. The order comes from the controls, never
 * from the key order of `errors`, so a server refusal that names its fields in wire
 * order still focuses the field this person meets first.
 */
export function firstProblem(
  controls: readonly Control[],
  errors: Readonly<Record<string, string>>,
): string | undefined {
  return controls.find((c) => errors[c.field.name] !== undefined)?.field.name;
}

/** Order is how a list is asked for: a sort the API understands, and equality filters by field. */
export interface Order {
  readonly sort: string;
  readonly filters: Readonly<Record<string, string>>;
}

export const noOrder: Order = { sort: "", filters: {} };

/**
 * sortFields are the fields a list can be ordered by, in the order its sheet lists
 * them: the entry's declared `sortable`, else the field it leads rows with plus the
 * date fields it declares.
 *
 * Three kinds are never offered, declared or not. `bool`, `list` and `uuid` have no
 * honest direction word — "false, then true" is nobody's order — and the two stamps
 * are said by "Newest first" and "Oldest first" already, which are the first two
 * rows of every sheet. A field the document calls plumbing is never offered either:
 * a sort row *names* the field, and naming plumbing in a sheet is naming it on screen.
 */
export function sortFields(e: Entry): readonly Field[] {
  const offerable = (f: Field): boolean =>
    !neverShown(f) &&
    !informationFields.includes(f.name) &&
    f.type !== "bool" &&
    f.type !== "list" &&
    f.type !== "uuid" &&
    f.type !== "picture";
  const declared = e.hints?.sortable;
  if (declared !== undefined)
    return declared.flatMap((name) => e.fields.filter((f) => f.name === name && offerable(f)));
  const named = rowPrimary(e);
  const dates = e.fields.filter((f) => f.type === "time" && f.name !== named?.name && offerable(f));
  return [...(named !== undefined && offerable(named) ? [named] : []), ...dates];
}

/**
 * sortOptions are the orders a list offers: newest, oldest, then each field the
 * sheet offers, once per direction. The values are the wire's and do not move — ""
 * is newest, `createdAt` oldest, a field name ascending and `-name` descending,
 * which is what `effects/api.ts` sends as `sort`. The *words* come from the copy
 * table and from the field's type: a deadline is "soonest first", a rank is "low to
 * high", a title is "A–Z", and none of them is said in English on a Portuguese phone.
 *
 * A closed set sorts A–Z because the kernel sorts the stored value, not the label the
 * author gave it; ordering a set by its declared words needs a sort contract the
 * kernel does not print yet, so the sheet says the order it actually performs.
 */
export function sortOptions(
  e: Entry,
  format: Formatting,
): readonly { readonly value: string; readonly label: string }[] {
  const kit = format.copy.kit;
  const out = [
    { value: "", label: kit.sortNewest },
    { value: "createdAt", label: kit.sortOldest },
  ];
  for (const f of sortFields(e)) {
    const word = fieldLabel(f);
    const pair =
      f.type === "time"
        ? [kit.sortSoon, kit.sortLate]
        : f.type === "int" || f.type === "float"
          ? [kit.sortLow, kit.sortHigh]
          : [kit.sortAZ, kit.sortZA];
    out.push({ value: f.name, label: pair[0]!(word) });
    out.push({ value: "-" + f.name, label: pair[1]!(word) });
  }
  return out;
}

/**
 * filterFields are the fields a list can be narrowed by: the ones with a closed set
 * of values. A group *names* its field above the choices, so plumbing the document
 * keeps off every screen is never a group either — naming is not drawing, which is
 * why `detail` still answers yes and `hidden` answers no.
 */
export const filterFields = (e: Entry): readonly Field[] =>
  e.fields.filter((f) => f.type !== "picture" && f.enum && f.enum.length > 0 && !neverShown(f));

/** queryFilters spells an Order's filters the way the API takes them. */
export const queryFilters = (order: Order): readonly string[] =>
  Object.entries(order.filters).map(([k, v]) => `${k}:${v}`);

/**
 * reordered says the list reads in an order somebody chose. It is not narrowing:
 * newest and soonest-first both show every record there is, so a sort never answers
 * "no matching notes" for a resource that holds none.
 */
export const reordered = (order: Order): boolean => order.sort !== "";

/**
 * filtered says a value is in force that leaves some records out — any filter the
 * person set, whether or not the entry still offers a control that can clear it.
 */
export const filtered = (order: Order): boolean =>
  Object.values(order.filters).some((value) => value !== "");

/**
 * activeFilters counts the groups the entry offers *and* holds a value for, which is
 * what the toolbar's "Filters · 2" says and what "Clear filters" would take away. A
 * value on a field the document stopped offering is filtered but not counted: the
 * control would promise to clear what it cannot reach.
 */
export const activeFilters = (order: Order, e: Entry): number =>
  filterFields(e).filter((f) => (order.filters[f.name] ?? "") !== "").length;

/** screenPath is where the router serves an entry's screens. */
export const screenPath = (e: NamesResource): `/${string}/${string}` =>
  `/${encodeURIComponent(e.module)}/${encodeURIComponent(e.entity)}`;

/**
 * NamesResource is the two words a resource is known by: a catalogue entry carries them and
 * so does an address read back out of a link, which is the other half of every route this
 * file spells. Nothing else about an entry is read here, so the words travel alone.
 */
export type NamesResource = Pick<Entry, "module" | "entity">;

/**
 * writePath is where an entry's writes are answered: POST, PATCH, PUT and
 * DELETE go here, GETs go to `path`. Most resources answer both at the same
 * address and print no `write_path`; the one that does — a control plane whose
 * writes are mounted on another surface — is not something a screen or a
 * transport gets to guess at.
 */
export const writePath = (e: Entry): string => e.writePath ?? e.path;

/** rowPlaceholder is the literal the kernel leaves in a printed command path. */
const rowPlaceholder = "{id}";

/**
 * verbRefusal is what a screen says when it is asked to send a verb the
 * resource does not mount. The door for such a verb is never drawn, so this is
 * the sentence for a sheet reached by a link or a stale notification rather
 * than for a choice somebody was offered — and the request itself is refused
 * before it is built, because the address it would go to is not there.
 */
export const verbRefusal = (verb: CrudVerb): string =>
  verb === "create"
    ? "This record cannot be created here."
    : verb === "update"
      ? "This record cannot be edited here."
      : verb === "delete"
        ? "This record cannot be deleted here."
        : "This is not available here.";

/**
 * commandPath is where a command is POSTed. The kernel prints an address only
 * when {entry.path}/{id}/{verb} — or {entry.path}/{verb} for a command about
 * the collection — is no longer where it mounted the verb, so a printed path is
 * the whole endpoint and already ends in the verb: it is used as it is read,
 * with the row substituted and the verb never appended again.
 */
export const commandPath = (e: Entry, verb: string, id?: string): string => {
  const printed = e.commands.find((c) => c.verb === verb)?.path;
  if (printed === undefined) {
    const at = id ? `${e.path}/${encodeURIComponent(id)}` : e.path;
    return `${at}/${encodeURIComponent(verb)}`;
  }
  if (!printed.includes(rowPlaceholder)) return printed;
  if (id === undefined) {
    throw new TypeError(`command "${verb}" is answered at ${printed}, which needs the row`);
  }
  return printed.split(rowPlaceholder).join(encodeURIComponent(id));
};

export * from "./collections";
export * from "./surfaces";
export * from "./audit";
export * from "./stepper";
export * from "./slots";
export * from "./calendar";
export * from "./commerce";
export * from "./pricing";
export * from "./map";
export * from "./media";
export * from "./charts";
export * from "./summary";
export * from "./table";
export type { Content, ContentModel, Page, Status, Control as ActionModel } from "./shared";

export * from "./catalogActivity";
export * from "./catalogList";
export * from "./failure";
export { kitExamples, kitCaseIds, type KitExamples, type GallerySelection } from "./kitGallery";
export { sceneFor, sceneNames, type Scene } from "./kitScenes";

/** personRecord retains only the authorized name and first visible declared portrait. */
export function personRecord(entry: Entry, row: Row, where: "row" | "detail"): Person {
  const name = referencedName(entry, row);
  const portrait = entry.fields.find(
    (f) =>
      f.present === "avatar" &&
      (f.type === "uuid" || f.type === "string") &&
      (where === "row" ? onList(f) : !neverShown(f)) &&
      pictureId(row[f.name]),
  );
  return {
    id: text(row.id),
    resource: `${entry.module}/${entry.entity}`,
    label: name,
    ...(name ? { name } : {}),
    ...(portrait ? { portrait: row[portrait.name] as string } : {}),
  };
}
export function personValue(
  field: Field,
  value: unknown,
  format: Formatting,
  names?: Names,
  people?: People,
  states: PictureStates = {},
  images = false,
  instance = field.name,
) {
  if (pointedAt(field) !== directory && field.present !== "person") return undefined;
  const values =
    field.type === "list"
      ? Array.isArray(value)
        ? value.map(text)
        : splitList(text(value))
      : [text(value)];
  const persons: Person[] = values
    .filter((v) => v.trim())
    .map((v) => {
      if (!points(field)) return { label: v, name: v };
      const at = nameKey(pointedAt(field) ?? "", v);
      const resolved = people?.[at];
      if (resolved) return { ...resolved, label: resolved.label || referenceWord(field, format) };
      return {
        id: v,
        resource: pointedAt(field) ?? "",
        label: names?.[at] ?? referenceWord(field, format),
        ...(names?.[at] && names[at] !== referenceWord(field, format) ? { name: names[at] } : {}),
      };
    });
  return avatarStack(persons, format, states, images, instance);
}
export function thumbnailField(entry: Entry): Field | undefined {
  const eligible = (name?: string) =>
    entry.fields.find(
      (f) =>
        f.name === name &&
        f.present === "image" &&
        (f.type === "uuid" || f.type === "string" || f.type === "picture") &&
        onList(f),
    );
  return eligible(entry.hints?.thumbnailField) ?? eligible(entry.hints?.coverField);
}
export function rowMedia(
  entry: Entry,
  row: Row,
  images = false,
  states: PictureStates = {},
): RowMediaModel {
  const icon = entryIcon(entry);
  const field = thumbnailField(entry);
  const id = field ? row[field.name] : undefined;
  const valid = field?.type === "picture" ? composedReference(id) : pictureId(id);
  if (images && valid && typeof id === "string") {
    const image = compactPicture(
      id,
      states,
      JSON.stringify(["row", `${entry.module}/${entry.entity}`, row.id]),
    );
    if (image.state === "error" && !icon) return { kind: "none" };
    return { kind: "picture", image, ...(icon ? { fallback: icon } : {}) };
  }
  return icon ? { kind: "icon", icon } : { kind: "none" };
}
export function homeMedia(entry: Entry): RowMediaModel {
  const media = rowMedia(entry, {});
  return media.kind === "none" ? { kind: "icon", icon: "grid" } : media;
}

/** visiblePictures selects bytes only for rendered media, a record's own galleries included, and the visible discs of each person group. */
export function visiblePictures(
  entry: Entry,
  rows: readonly Row[],
  people: People,
  where: "row" | "detail",
  format: Formatting,
  informationOpen = false,
): readonly string[] {
  const ids: string[] = [];
  for (const row of rows) {
    if (where === "row") {
      const leading = listRow(entry, row, format, format.copy.kit.untitled, undefined, true);
      if (leading.avatar?.image) ids.push(leading.avatar.image.slot.id);
      if (leading.media?.kind === "picture") ids.push(leading.media.image.slot.id);
    }
    if (where === "detail") ids.push(...recordPictureIds(entry, row));
    const fields =
      where === "row"
        ? listCells(entry)
        : [
            ...shownFields(entry, row, (f) => f.hints?.visibility !== "detail"),
            ...(informationOpen ? informationHeld(entry, row) : []),
          ];
    for (const field of fields) {
      const group = personValue(field, row[field.name], format, undefined, people, {}, true);
      for (const person of group?.people ?? []) if (person.image) ids.push(person.image.slot.id);
    }
  }
  return [...new Set(ids)];
}

export function accountPerson(
  identity: {
    readonly userId: string;
    readonly email: string;
    readonly displayName?: string | null;
  },
  resolved?: Person,
): Person {
  const name = identity.displayName?.trim() || identity.email;
  return { ...resolved, id: identity.userId, resource: directory, name, label: name };
}
export function accountPointers(entries: readonly Entry[], userId?: string): readonly Pointer[] {
  const user = entries.find((e) => `${e.module}/${e.entity}` === directory);
  return userId &&
    user &&
    user.operations?.includes("read") !== false &&
    user.fields.some((f) => f.present === "avatar" && !neverShown(f))
    ? [{ resource: directory, id: userId }]
    : [];
}

/**
 * firstName is the one word a greeting may use.
 *
 * An address is not a name: a display name holding `@` greets nobody, because
 * "Good morning, joao" from joao@acme.test would say the app cannot tell the two
 * apart and the person would be right to hear it as a mistake. A compound name is
 * greeted by its first word (`Ana Rita` → Ana, `Maria do Carmo` → Maria), a
 * hyphenated given name stays the one word it is, and the punctuation a directory
 * leaves on the end of a name is not part of it. The rule never invents a name: an
 * empty answer, and a value too long to be one word, both greet nobody.
 */
const firstNameMax = 32;

export function firstName(displayName: string): string {
  const trimmed = displayName.trim();
  if (trimmed.includes("@")) return "";
  const word = trimmed.split(/\s+/)[0]!.replace(/^[.,;:!?–—-]+|[.,;:!?–—-]+$/g, "");
  return word === "" || word.length > firstNameMax ? "" : word;
}

/**
 * Greeting is Home's first sentence and the name it is said to — empty when nobody
 * may be named, which the organism draws as the part of day alone.
 */
export interface Greeting {
  readonly line: string;
  readonly name: string;
}

/**
 * greeting says the part of day the reader's own clock is in, and greets the reader
 * by first name when the session or the directory holds one.
 *
 * The hour is read in `Presentation.timeZone`, the reader's zone, so a person at
 * 03:20 their time stands in the night band whatever the server's UTC says. Three
 * bands and not four, because that is what both languages this table speaks greet
 * with: morning 05:00–11:59, afternoon 12:00–16:59, evening from 17:00 until 05:00,
 * and "Good night"/"Boa noite" is a farewell no screen says to a person it is
 * keeping. An instant this build cannot read claims no band at all, so `line` is
 * empty and the screen says nothing rather than guessing a morning.
 */
export function greeting(
  person: { readonly name?: string } | undefined,
  p: Presentation,
): Greeting {
  const name = person?.name === undefined ? "" : firstName(person.name);
  const at = instantValue(p.now);
  if (at === undefined) return { line: "", name };
  const hour = civilHour(at, p.timeZone);
  const part =
    hour < 5
      ? p.copy.kit.goodEvening
      : hour < 12
        ? p.copy.kit.goodMorning
        : hour < 17
          ? p.copy.kit.goodAfternoon
          : p.copy.kit.goodEvening;
  return { line: p.copy.kit.greeting(part, name), name };
}

/**
 * workspaceName is what the page calls the place these records live.
 *
 * The name the workspace itself answered wins: it is the word that place uses for itself,
 * and a phone that has read it and still prints an address would be saying less than it
 * knows. What a person typed, reduced to its host, is what is left when nothing answered,
 * and the copy table's own word for a workspace when the address cannot be read either. A
 * product name in either place would say which app this is, which nobody reading their own
 * list asks.
 */
export const workspaceName = (baseURL: string, copy: Copy, answered?: string): string =>
  answered?.trim() || hostLabel(baseURL) || copy.kit.workspace;
