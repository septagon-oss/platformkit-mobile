/** header: what a record opens with - its name, its status, its cover. */
import { Entry, Field } from "../catalog";
import { policyStatus, policyTitleFields } from "../derivePolicy";
import { type Formatting } from "../presentation";
import { type Copy } from "../copy";
import {
  type FileMeta,
  filePicture,
  type FramedPicture,
  noMeta,
  type PictureFrame,
  pictureId,
  pictureState,
  type PictureStates,
} from "../pictures";
import { galleryIds, namedBy, neverShown, rowId } from "../internals";
import {
  type Names,
  badgeTone,
  display,
  enumTone,
  hasValue,
  label,
  noun,
  points,
  text,
} from "../present";
import { listPreview } from "../list";

export type Row = Readonly<Record<string, unknown>>;

/**
 * primary is the field the record is recognised by: the chain over every field a
 * person is shown, `detail` included, since the record answers a `detail` field
 * and a row has no room for it. It answers `undefined` rather than fabricating an
 * `id` the schema does not hold: a record with nothing to read says so (`label`
 * below) instead of quoting an identifier nobody chose to look at.
 */
export function primary(e: Entry): Field | undefined {
  const titled = policyTitleFields(e, "record");
  if (titled) return titled[0];
  return namedBy(
    e,
    e.fields.filter((f) => !neverShown(f) && f.type !== "picture"),
  );
}

/**
 * statusField is the field whose value the record's pill shows, or nothing.
 *
 * No status is ever inferred from "the first enum field": a pill that guesses
 * says something the document did not say, and a pointer at plumbing names no
 * pill either. The declaration is read here and drawn by whoever draws the pill
 * (T-0323).
 */
export const statusField = (e: Entry): Field | undefined => {
  const declared = policyStatus(e) ?? e.hints?.statusField;
  return declared === undefined || declared === ""
    ? undefined
    : e.fields.find((f) => f.name === declared && f.type !== "picture" && !neverShown(f));
};

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
export const finishedValues = (e: Entry): readonly string[] => {
  const status = statusField(e);
  return status?.policy
    ? (status.policy.options ?? []).filter((o) => o.done).map((o) => o.value)
    : (status?.hints?.doneValues ?? []);
};

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
