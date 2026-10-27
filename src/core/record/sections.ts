/** sections: the blocks a record shows beneath its header. */
import { Entry, Field } from "../catalog";
import { type PictureFrame } from "../pictures";
import { type Formatting } from "../presentation";
import { copyLanguage } from "../copy";
import { informationHeld, recordField, shownFields } from "../internals";
import {
  type RecordPictures,
  type RecordStrip,
  type Row,
  primary,
  recordMedia,
  statusField,
} from "./header";
import { type Names, label, points, text } from "../present";

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
 * informationFields are the record's own three: the identifier and the two stamps.
 * Not a declaration — no document carries "this field is plumbing" — but the three
 * names every resource the kernel mounts has, and the three a person reaches for
 * when a support conversation needs them. Declaring them here, once, is what keeps
 * the id out of every other sentence about the record.
 */
export const informationFields: readonly string[] = ["id", "createdAt", "updatedAt"];

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
