import type { HintNotice } from "./catalog";
import type { Formatting } from "./presentation";
import type { ImageSlotProps } from "./media";
import type { Status } from "./shared";

export interface Pictures {
  readonly source: string;
  readonly widths?: readonly number[];
}
export const resourceIcons = [
  "task",
  "person",
  "people",
  "document",
  "settings",
  "plan",
  "calendar",
  "folder",
  "chart",
  "message",
  "money",
  "box",
  "tag",
  "building",
  "location",
  "link",
] as const;
export type ResourceIcon = (typeof resourceIcons)[number];
export const pictureId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

/** pictureDoor accepts the native client's relative template subset; defects disable only pictures. */
export function pictureDoor(raw: unknown, notice: HintNotice): Pictures | undefined {
  if (raw == null) return undefined;
  const source = typeof raw === "object" ? (raw as Record<string, unknown>).source : undefined;
  if (
    typeof source !== "string" ||
    !source.startsWith("/api/v1/") ||
    source.split("/").filter((s) => s === "{id}").length !== 1 ||
    !source
      .slice(1)
      .split("/")
      .every((s) => s === "{id}" || (/^[A-Za-z0-9_.-]+$/.test(s) && !/^\.+$/.test(s)))
  ) {
    notice(
      "pictures.source",
      "is not a supported relative picture template: pictures are not loaded",
    );
    return undefined;
  }
  const widths = (raw as Record<string, unknown>).widths;
  if (widths == null || (Array.isArray(widths) && widths.length === 0)) return { source };
  if (
    !Array.isArray(widths) ||
    !widths.every((w, i) => Number.isSafeInteger(w) && w > 0 && (i === 0 || w > widths[i - 1]))
  ) {
    notice("pictures.widths", "is not an ascending set of positive widths: the original is used");
    return { source };
  }
  return { source, widths };
}
export interface Person {
  readonly id?: string;
  readonly resource?: string;
  readonly name?: string;
  readonly label: string;
  readonly portrait?: string;
}
export type People = Readonly<Record<string, Person>>;
export type PictureStates = Readonly<Record<string, "loading" | "ready" | "error">>;
export interface CompactPicture {
  readonly slot: ImageSlotProps;
  readonly state: "loading" | "ready" | "error";
}
export interface AvatarModel {
  readonly name: string;
  readonly initials: string;
  readonly tone: Exclude<Status["tone"], "danger">;
  readonly image?: CompactPicture;
}
export interface AvatarStackModel {
  readonly people: readonly AvatarModel[];
  readonly remainder?: string;
  readonly description: string;
}
export type RowMediaModel =
  | { readonly kind: "none" }
  | { readonly kind: "icon"; readonly icon: ResourceIcon | "grid" }
  | { readonly kind: "picture"; readonly image: CompactPicture; readonly fallback?: ResourceIcon };

/** avatarTone assigns a stable visual bucket to UTF-16 IDs, independent of names and locale. */
export function avatarTone(id = ""): AvatarModel["tone"] {
  if (!id.trim()) return "neutral";
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619) >>> 0;
  return (["info", "ok", "warning", "neutral"] as const)[hash % 4]!;
}
export function initials(name = ""): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const first = words[0];
  if (!first) return "";
  return (
    Array.from(first)[0]! + (words.length > 1 ? Array.from(words[words.length - 1]!)[0]! : "")
  ).toUpperCase();
}
/** compactPicture scopes slot state to its file, falling back to that file's metadata state. */
export function compactPicture(id: string, states: PictureStates, instance = id): CompactPicture {
  const identity = JSON.stringify([id, instance]);
  return {
    slot: {
      id,
      instance: identity,
      description: "",
      decorative: true,
      fit: "cover",
      aspectRatio: 1,
      caption: false,
    },
    state: states[identity] ?? states[id] ?? "loading",
  };
}
export function avatar(
  person: Person,
  states: PictureStates = {},
  images = false,
  instance = JSON.stringify(["avatar", person.resource, person.id, person.label]),
): AvatarModel {
  return {
    name: person.label,
    initials: initials(person.name),
    tone: avatarTone(person.id),
    ...(images && person.portrait
      ? { image: compactPicture(person.portrait, states, instance) }
      : {}),
  };
}
export function avatarStack(
  people: readonly Person[],
  format: Formatting,
  states: PictureStates = {},
  images = false,
  instance = "group",
): AvatarStackModel {
  const seen = new Set<string>();
  const distinct = people.filter((p) => {
    if (!p.id?.trim() && !p.name?.trim() && !p.label.trim()) return false;
    if (!p.id?.trim()) return true;
    const key = `${p.resource ?? ""}|${p.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const count = (n: number) => new Intl.NumberFormat(format.locale).format(n);
  return {
    people: distinct
      .slice(0, 3)
      .map((p, i) => avatar(p, states, images, JSON.stringify([instance, p.resource, p.id ?? i]))),
    ...(distinct.length > 3
      ? { remainder: format.copy.kit.peopleRemainder(count(distinct.length - 3)) }
      : {}),
    description:
      distinct.length > 1
        ? format.copy.kit.peopleDescription(
            distinct[0]!.label,
            count(distinct.length - 1),
            distinct.length - 1,
          )
        : (distinct[0]?.label ?? ""),
  };
}
