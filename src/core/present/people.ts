/** people: one person as a row, a stack and a greeting. */
import {
  avatar,
  avatarStack,
  type People,
  type Person,
  pictureId,
  type PictureStates,
} from "../pictures";
import { Entry, Field } from "../catalog";
import { civilHour, type Formatting, instantValue, type Presentation } from "../presentation";
import { type Copy } from "../copy";
import { directory, firstNameMax, neverShown, referenceWord } from "../internals";
import {
  type Names,
  hostLabel,
  label,
  nameKey,
  pointedAt,
  points,
  referencedName,
  text,
} from "./words";
import { type Row } from "../record";
import { onList } from "../list";
import { splitList, values } from "../form";

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
