/** rows: one wire row as the list draws it. */
import { avatar, type AvatarModel, type PictureStates, type RowMediaModel } from "../pictures";
import { savedCopy } from "../saved";
import { DataCell } from "../collections";
import { Status } from "../shared";
import { Entry, Field } from "../catalog";
import { type Copy } from "../copy";
import { type Formatting } from "../presentation";
import { directory } from "../internals";
import { listCells, listPreview, rowPrimary } from "./columns";
import { type Row, statusPill } from "../record";
import { kind, values } from "../form";
import {
  type Names,
  display,
  fieldLabel,
  hasValue,
  label,
  personRecord,
  rowMedia,
  saidValue,
} from "../present";

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
  /**
   * tone is the row's own voice, and `muted` is the only shade a derived row wears: the
   * record this row is a copy of has gone, or the provider that holds it is down. The
   * sentence that says which arrives as the row's `summary`, from `savedCopy`, and the
   * row presses, speaks and opens exactly as it did — a copy this person kept is still
   * theirs. Absent is an ordinary row: nothing guesses the shade.
   */
  readonly tone?: "muted";
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
  // What this row's source still is, read from the field the entry itself declared.
  // A copy of something that went says so in place of its own line: the fact a person
  // needs off a list of copies is what they can no longer reach, not what the copy
  // holds. An entry that declares no availability field answers nothing here.
  const source = savedCopy(e, row, format.copy);
  return {
    title: label(e, row, untitled, "row", names),
    ...(`${e.module}/${e.entity}` === directory
      ? { avatar: avatar(personRecord(e, row, "row"), states, images) }
      : media.kind === "none"
        ? {}
        : { media }),
    ...(source ? { tone: "muted" as const } : {}),
    ...(source
      ? { summary: source.summary }
      : preview && hasValue(preview, row[preview.name])
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
