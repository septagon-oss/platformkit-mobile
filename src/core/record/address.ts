/** address: where a record lives and the records it points at. */
import { Entry, Field } from "../catalog";
import { directory, headerDrawnList, informationHeld, neverShown, shownFields } from "../internals";
import { type Row, statusField } from "./header";
import { display, nameKey, pointedAt, points, text } from "../present";
import { splitList } from "../form";
import { listCells, listPreview, rowPrimary } from "../list";

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

/** screenPath is where the router serves an entry's screens. */
export const screenPath = (e: NamesResource): `/${string}/${string}` =>
  `/${encodeURIComponent(e.module)}/${encodeURIComponent(e.entity)}`;

/**
 * NamesResource is the two words a resource is known by: a catalogue entry carries them and
 * so does an address read back out of a link, which is the other half of every route this
 * file spells. Nothing else about an entry is read here, so the words travel alone.
 */
export type NamesResource = Pick<Entry, "module" | "entity">;

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
 * personPointers resolves bare person ids against the installation's directory, the way
 * accountPointers resolves the one person this session belongs to. A projection that answers an
 * array of person ids prints no pointer beside them, so nothing downstream could tell which
 * resource they live in; this names it once. Without a readable directory the ids stay what the
 * server said, which a screen draws as no faces rather than as guesses.
 */
export function personPointers(
  entries: readonly Entry[],
  ids: readonly string[],
): readonly Pointer[] {
  const user = entries.find((e) => `${e.module}/${e.entity}` === directory);
  if (user === undefined || user.operations?.includes("read") === false) return [];
  return [...new Set(ids.filter((id) => id !== ""))].map((id) => ({
    resource: directory,
    id,
  }));
}
