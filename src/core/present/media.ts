/** media: the pictures a row or a workspace draws. */
import { Entry, Field } from "../catalog";
import {
  avatar,
  compactPicture,
  composedReference,
  entryIcon,
  type People,
  pictureId,
  type PictureStates,
  type RowMediaModel,
} from "../pictures";
import { type Formatting } from "../presentation";
import { informationHeld, shownFields } from "../internals";
import { personValue } from "./people";
import { listCells, listRow, onList } from "../list";
import { type Row, recordPictureIds } from "../record";
import { kind } from "../form";

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
