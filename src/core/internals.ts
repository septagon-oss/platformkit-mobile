/**
 * internals holds the field rules every door reads and no person sees: which fields a
 * surface may draw and what a field's name means before it is spelled out. It is not a
 * door - nothing outside src/core imports it, and every name it holds stays private to
 * the doors.
 */
import { Entry, Field } from "./catalog";
import { type Formatting } from "./presentation";
import { policyOnRecord } from "./derivePolicy";
import { pictureId } from "./pictures";
import { copyLanguage, type Language } from "./copy";
import {
  type Names,
  display,
  enumLabel,
  fieldLabel,
  firstName,
  greeting,
  hasValue,
  label,
  nameKey,
  noun,
  plural,
  pointedAt,
  points,
  saidValue,
  text,
} from "./present";
import { type Control, kind, problems, splitList, timeValue, timeWire, values } from "./form";
import {
  type DetailItem,
  type Row,
  coverPicture,
  galleryFields,
  informationFields,
  pointerTargets,
  primary,
  recordHeader,
  recordInformation,
  recordSections,
  servedLanguage,
  statusField,
} from "./record";
import { listPreview, onList } from "./list";

/**
 * massNouns are the words that are already a plural: a catalogue noun is an
 * entity name the server chose, and "content" is never made "contents" by this
 * function. The set is this kit's English share; a noun a customer invents
 * ("sla policy") is answered by the rule below, not by more English grammar here.
 */
export const massNouns = new Set([
  "content",
  "settings",
  "news",
  "media",
  "data",
  "staff",
  "feedback",
  "information",
]);

/**
 * directory is the resource whose records are the people of the workspace. It is
 * the same pair `useActivity` reads its actor names from, and it is the one
 * pointer a phone can always try to list: whether the read is allowed is the
 * server's answer, not this constant's.
 */
export const directory = "user/user";

/**
 * referenceWord is what a pointer says when this screen holds no name for it: a
 * person is *assigned* and anything else is *linked*. The choice is made of what
 * the value points at and of nothing else — never of whether a read answered,
 * because a name this person was refused and a name nobody could resolve are the
 * same fact to the person reading the row, and neither is worth an error.
 */
export function referenceWord(f: Field, format: Formatting): string {
  return pointedAt(f) === directory
    ? format.copy.kit.referenceAssigned
    : format.copy.kit.referenceLinked;
}

/**
 * nameLike are the wire names a row is recognised by before any other string:
 * the three an author reaches for when they want a record to have a title.
 */
export const nameLike: readonly string[] = ["title", "name", "displayName"];

/**
 * neverShown is the one visibility no screen draws. `hidden` is integration
 * plumbing: the value stays in the schema, the JSON and the PATCH, where nothing
 * a person reads is drawn from it — so it is neither drawn nor named by anything
 * that is. The kernel says the same thing at mount (`kit/rest/hints.go`,
 * `namedFieldFault`: "a row is not named by its plumbing") and refuses the
 * document; the phone refuses the pointer and keeps the screens, because one
 * author's slip is not worth this app.
 */
export const neverShown = (f: Field): boolean => f.hints?.visibility === "hidden";

/**
 * offRecord is the field the server kept off its own record (`fields[].onRecord:
 * false`). It is `hidden`'s declared cousin, one screen narrower: the value stays in
 * the schema and the write, and no block of the record draws it. A pointer the same
 * block names — this record's title, its pill or its summary line — is the sharper
 * instruction and still reads the field, because naming a fact at the top of a record
 * is drawing it there, not drawing it twice.
 */
export const offRecord = (f: Field): boolean => policyOnRecord(f) === false;

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
export function namedBy(e: Entry, fields: readonly Field[]): Field | undefined {
  const declared = e.hints?.primaryField;
  return (
    (declared === undefined ? undefined : fields.find((f) => f.name === declared)) ??
    fields.find((f) => nameLike.includes(f.name)) ??
    fields.find((f) => f.type === "string" && !(f.enum && f.enum.length > 0))
  );
}

/** policyTitle is the first candidate the row holds words for, else its identifier, else nothing. */
export function policyTitle(
  e: Entry,
  candidates: readonly Field[],
  row: Row,
  names?: Names,
): string {
  const held = (f: Field): string =>
    points(f)
      ? (names?.[nameKey(pointedAt(f) ?? "", text(row[f.name]))] ?? "")
      : text(row[f.name]).trim();
  return candidates.map(held).find((v) => v !== "") ?? text(row.id).trim();
}

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
export const rowContent = (f: Field): boolean =>
  f.hints?.visibility === undefined || f.hints.visibility === "shown";

/**
 * rowFields are the fields a row is made of: what the schema puts on a list, in
 * schema order, never the id. This is the one place the list asks which fields it
 * has, so the columns it draws, the field it leads a row with and the cells beside
 * it cannot disagree about the answer.
 */
export const rowFields = (e: Entry): readonly Field[] =>
  e.fields.filter((f) => f.name !== "id" && f.type !== "picture" && onList(f));

/** printed is a field only while a line can print its value: a rich text body has no printed form. */
export function printed(f: Field | undefined): Field | undefined {
  return f !== undefined && (f.widget === "richtext" || f.type === "picture") ? undefined : f;
}

/**
 * recordFields are a record's own rows: one item per field, the label the author
 * gave the field and the value read aloud the way `saidValue` reads it. It is the
 * whole of what a row on a record is made of; which rows a person is shown, and
 * above or below which line, is `recordHeader`, `recordSections` and
 * `recordInformation`.
 */
export const recordField = (
  f: Field,
  v: unknown,
  format: Formatting,
  names?: Names,
): DetailItem => ({
  field: f,
  label: fieldLabel(f),
  ...saidValue(f, v, format, names),
});

/** rowId is the record's own identifier as a slot's instance needs it: "" for a row not yet stored. */
export const rowId = (row: Row): string => text(row.id);

/** galleryIds are the file identifiers one gallery field's row holds, in the order it holds them. */
export const galleryIds = (field: Field, row: Row): readonly string[] => {
  const value = row[field.name];
  return (Array.isArray(value) ? (value as unknown[]).map(text) : splitList(text(value))).filter(
    pictureId,
  );
};

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
export const headerDrawn = (e: Entry): ReadonlySet<string> =>
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
export const headerDrawnList = (e: Entry): readonly Field[] =>
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
export function shownFields(e: Entry, row: Row, keep: (f: Field) => boolean): readonly Field[] {
  const drawn = headerDrawn(e);
  return e.fields.filter(
    (f) =>
      !neverShown(f) &&
      !offRecord(f) &&
      f.type !== "picture" &&
      !drawn.has(f.name) &&
      !informationFields.includes(f.name) &&
      keep(f) &&
      hasValue(f, row[f.name]),
  );
}

/**
 * informationHeld are the fields the record's own block draws: the three stamps,
 * in that order, and every field the document keeps for this screen (`detail`) a
 * higher place has not already drawn. It is asked both by the block below and by
 * `pointerTargets`, so "which fields does this medium draw" stays one answer.
 */
export function informationHeld(e: Entry, row: Row): readonly Field[] {
  const drawn = headerDrawn(e);
  const stamps = informationFields.flatMap((name) =>
    e.fields.filter(
      (f) =>
        f.name === name &&
        f.type !== "picture" &&
        !neverShown(f) &&
        !offRecord(f) &&
        hasValue(f, row[f.name]),
    ),
  );
  const kept = e.fields.filter(
    (f) =>
      f.hints?.visibility === "detail" &&
      !neverShown(f) &&
      !offRecord(f) &&
      f.type !== "picture" &&
      !drawn.has(f.name) &&
      !informationFields.includes(f.name) &&
      hasValue(f, row[f.name]),
  );
  return [...stamps, ...kept];
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
export function heldLanguage(
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

/** control is one field as a form holds it: the same rules wherever the field came from. */
export function control(f: Field, value: string, immutable: boolean): Control {
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

/** listValues retains the element types the server declared, or refuses the whole list. */
export function listValues(field: Field, raw: string): (string | number | boolean)[] | undefined {
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
export function sameAnswer(c: Control, typed: string): boolean {
  if (typed === c.value) return true;
  if (c.kind === "switch") return (typed === "true") === (c.value === "true");
  if (c.kind !== "datetime") return false;
  const now = timeValue(typed);
  const then = timeValue(c.value);
  return now !== undefined && then !== undefined && now.getTime() === then.getTime();
}

/**
 * offerable is whether a sort row may name this field at all. Three kinds never are:
 * `bool`, `list` and `uuid` have no honest direction word — "false, then true" is
 * nobody's order — and the two stamps are said by "Newest first" and "Oldest first"
 * instead. A field the document calls plumbing is never offered either: a sort row
 * *names* the field, and naming plumbing in a sheet is naming it on screen.
 */
export const offerable = (f: Field): boolean =>
  !neverShown(f) &&
  !informationFields.includes(f.name) &&
  f.type !== "bool" &&
  f.type !== "list" &&
  f.type !== "uuid" &&
  f.type !== "picture";

/**
 * directionWords is the pair of order words a field type takes, ascending first: the
 * phone's own copy, never the server's, because "low to high" is the phone's sentence
 * about the order it performs on the value the server sent.
 */
export const directionWords = (
  type: Field["type"],
  kit: Formatting["copy"]["kit"],
): readonly [(word: string) => string, (word: string) => string] =>
  type === "time"
    ? [kit.sortSoon, kit.sortLate]
    : type === "int" || type === "float"
      ? [kit.sortLow, kit.sortHigh]
      : [kit.sortAZ, kit.sortZA];

/** rowPlaceholder is the literal the kernel leaves in a printed command path. */
export const rowPlaceholder = "{id}";

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
export const firstNameMax = 32;
