// derive.ts is ADR 0007 on a phone: what a list, a detail and a form are, given
// only an entry's schema. The rules are the web generator's (ui/screens in the
// public repository), restated in one place so the two shells agree — a status
// is "Open" in a cell there and in a cell here.
import type { Command, CrudVerb, Entry, Field, HintTone } from "./catalog";
import type { Copy } from "./copy";
import type { EntrySubject } from "./failure";
import { presentedInstant, presentedTime, type Formatting } from "./presentation";

export { copyForLocale, copyLanguage, deriveCopy, type Copy, type Language } from "./copy";
export { stateExamples, type StateExample } from "./stateGallery";
export {
  deriveFeedback,
  instantValue,
  presentedTime,
  presentedInstant,
  civilDay,
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

/** display is a value as a person reads it; nothing at all is a dash. */
export function display(f: Field, v: unknown, format: Formatting): string {
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
    e.fields.filter((f) => !neverShown(f)),
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
): string {
  const at = where === "record" ? primary(e) : rowPrimary(e);
  return (at === undefined ? "" : text(row[at.name])) || untitled(noun(e).singular);
}

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
    : e.fields.find((f) => f.name === e.hints?.statusField && !neverShown(f));

/**
 * iconName is the word an entry asks for its glyph. It answers the word and draws
 * nothing: which glyphs this build ships belongs to `ui/atoms/Icon.tsx`, and a
 * name it does not hold draws the generic one.
 */
export const iconName = (e: Entry): string | undefined => e.hints?.icon;

/**
 * rowContent is a field's own answer about what a row may *say*: silence about its
 * visibility, or a declared `shown`, and the field's words may be read on a line
 * of a list — as its name, as the line under the name, or as a cell beside it.
 * `detail` and `hidden` answer no: the first is the record's own answer, which
 * `detailItems` gives and a row has no room for, and the second is nobody's.
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
  e.fields.filter((f) => f.name !== "id" && onList(f));

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
 */
export function listCells(e: Entry, limit = 3): readonly Field[] {
  const declared = e.hints?.summaryFields;
  if (declared !== undefined)
    // Declared means exactly those, in the order the author gave them, minus any
    // field a row may not speak of: `limit` is this build's budget for a ranking
    // nobody asked for, and neither plumbing nor the record's own paragraph is a
    // cell whoever pointed at it.
    return declared.flatMap((name) => e.fields.filter((f) => f.name === name && rowContent(f)));
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
    .filter((f) => f.name !== named?.name && f.name !== preview?.name)
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .slice(0, limit)
    .map(({ f }) => f);
}

/**
 * listPreview is the field a row shows a line of under its name: the first
 * long text the entity has, which is what a person reads to recognise the
 * record.
 *
 * `hide:list` does not disqualify it. That tag says a value does not belong
 * in a table column, which is true of every long text and is why a schema
 * marks them: a paragraph ruins a column. A line under the name is not a
 * column, and the paragraph is exactly what is worth reading there. It stays
 * out of the cells beside it, which are columns. A declared visibility does
 * disqualify it, in both readings: `detail` is the paragraph a person reads on
 * the record and nowhere else, and a pointer at it cannot make the row quote it.
 */
export function listPreview(e: Entry): Field | undefined {
  const declared = e.hints?.previewField;
  if (declared !== undefined) return e.fields.find((f) => f.name === declared && rowContent(f));
  const named = rowPrimary(e);
  return e.fields.find(
    (f) =>
      f.name !== named?.name &&
      rowContent(f) &&
      !f.readOnly &&
      (f.type === "text" || f.widget === "textarea"),
  );
}

/**
 * saidValue is a field's value as the eye reads it and as a reader says it aloud.
 * The two are the same words except for an instant: a cell shows the distance
 * ("5 minutes ago") and a screen reader says the whole local date-time. No
 * `spoken` means the shown words are the whole fact, which is true of every other
 * field type.
 */
export function saidValue(
  f: Field,
  v: unknown,
  format: Formatting,
): { readonly value: string; readonly spoken?: string } {
  const at = f.type === "time" ? timeValue(v) : undefined;
  const instant = at ? presentedInstant(at, format) : undefined;
  return { value: display(f, v, format), ...(instant ? { spoken: instant.exact } : {}) };
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
 * detailItems is a record's own screen: every field a person is shown there, in
 * schema order. `hideList` hides nothing here — that tag is about a table being
 * readable, not about a field being secret — and `hidden` is the one declaration
 * that is off this screen too, its value left in the JSON and the PATCH.
 */
export function detailItems(e: Entry, row: Row, format: Formatting): readonly DetailItem[] {
  return e.fields
    .filter((f) => !neverShown(f))
    .map((f) => ({
      field: f,
      label: fieldLabel(f),
      ...saidValue(f, row[f.name], format),
    }));
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
}

/** kind is the control a field gets: the tag when the entity named one, the type otherwise. */
export function kind(f: Field): ControlKind {
  if ((f.enum && f.enum.length > 0) || f.widget === "select") return "select";
  if (f.widget === "textarea") return "textarea";
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

/** control is one field as a form holds it: the same rules wherever the field came from. */
function control(f: Field, value: string, immutable: boolean): Control {
  const k = kind(f);
  // The author's help line reads the form; the developer's `doc` is the fallback
  // it has always had. Deleting that fallback is a visible change to every
  // un-hinted form, so it belongs to whoever redraws the form (T-0324).
  const notes = [f.hints?.help ?? f.doc ?? ""];
  if (immutable) notes.push("Changed by a command of its own, not by this form.");
  if (k === "reference") {
    notes.push("The identifier of the related record. There is no picker for it yet.");
  }
  if (k === "list") notes.push("Comma separated.");
  return {
    kind: k,
    field: f,
    label: fieldLabel(f),
    value,
    required: f.required === true,
    readOnly: immutable,
    help: notes.filter(Boolean).join(" "),
    options: (f.enum ?? []).map((v) => ({ value: v, label: enumLabel(f, v) })),
  };
}

/** formControls: one control per writable field; immutable fields are read-only on edit and absent on create. */
export function formControls(e: Entry, row: Row | undefined, create: boolean): readonly Control[] {
  const out: Control[] = [];
  for (const f of e.fields) {
    if (f.readOnly) continue;
    // A field the author hid is plumbing: it stays in the schema, the JSON and
    // the PATCH, but not in the sheet. A *required* field is the exception —
    // taking the person's only path to a submittable create away is the write
    // this build never makes, and one ugly row is the lesser screen. The parser
    // already named the pair once.
    if (f.hints?.visibility === "hidden" && f.required !== true) continue;
    const immutable = e.immutable.includes(f.name);
    if (create && immutable) continue;
    const value = row && f.name in row ? text(row[f.name]) : create ? (f.default ?? "") : "";
    out.push(control(f, value, immutable));
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
  return c.fields.map((f) => control(f, f.default ?? "", false));
}

/**
 * commandTitle is what a person taps: the summary the API document gives, or
 * the verb spelled as words when it gives none.
 */
export const commandTitle = (c: Command): string => c.hints?.label || c.summary || humanize(c.verb);

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
 * problems is what a form can refuse before the server does: a number that is
 * not one, an instant that is not one. Required and everything else are the
 * server's, answered in the same shape, so a form shows both the same way.
 */
export function problems(
  controls: readonly Control[],
  held: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const c of controls) {
    if (c.readOnly) continue;
    const raw = held[c.field.name] ?? c.value;
    if (raw === "") continue;
    if (c.kind === "number" && numberValue(raw) === undefined)
      out[c.field.name] = "is not a number";
    if (c.kind === "datetime" && timeValue(raw) === undefined) out[c.field.name] = "is not a time";
    if (c.kind === "list" && listValues(c.field, raw) === undefined)
      out[c.field.name] = "contains a value that does not match its item type";
  }
  return out;
}

/** Order is how a list is asked for: a sort the API understands, and equality filters by field. */
export interface Order {
  readonly sort: string;
  readonly filters: Readonly<Record<string, string>>;
}

export const noOrder: Order = { sort: "", filters: {} };

/** sortOptions are the orders a list offers: newest, oldest, then each visible column both ways. */
export function sortOptions(e: Entry): readonly { value: string; label: string }[] {
  const out = [
    { value: "", label: "Newest first" },
    { value: "createdAt", label: "Oldest first" },
  ];
  for (const f of listColumns(e)) {
    if (f.type === "bool" || f.type === "list" || f.type === "uuid") continue;
    if (f.name === "createdAt") continue;
    const word = fieldLabel(f);
    out.push({ value: f.name, label: `${word}, ascending` });
    out.push({ value: "-" + f.name, label: `${word}, descending` });
  }
  return out;
}

/** filterFields are the fields a list can be narrowed by: the ones with a closed set of values. */
export const filterFields = (e: Entry): readonly Field[] =>
  e.fields.filter((f) => f.enum && f.enum.length > 0);

/** queryFilters spells an Order's filters the way the API takes them. */
export const queryFilters = (order: Order): readonly string[] =>
  Object.entries(order.filters).map(([k, v]) => `${k}:${v}`);

/** narrowed says whether a list is showing less than everything, which changes what "empty" means. */
export const narrowed = (order: Order): boolean =>
  order.sort !== "" || Object.keys(order.filters).length > 0;

/** screenPath is where the router serves an entry's screens. */
export const screenPath = (e: Entry): `/${string}/${string}` =>
  `/${encodeURIComponent(e.module)}/${encodeURIComponent(e.entity)}`;

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
export * from "./table";
export type { Content, ContentModel, Page, Status, Control as ActionModel } from "./shared";

export * from "./catalogActivity";
export * from "./catalogList";
export * from "./failure";
export { kitExamples, kitCaseIds, type KitExamples, type GallerySelection } from "./kitGallery";
export { sceneFor, sceneNames, type Scene } from "./kitScenes";
