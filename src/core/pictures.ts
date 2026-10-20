import type { Entry, HintNotice } from "./catalog";
import type { Formatting } from "./presentation";
import type { ImageSlotProps, MediaItem } from "./media";
import type { Status } from "./shared";

export interface Pictures {
  readonly source?: string;
  readonly composedSource?: string;
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

/**
 * iconName is the word an entry asks for its glyph. It answers the word and draws
 * nothing: which glyphs this build ships belongs to `ui/atoms/Icon.tsx`, and a
 * name it does not hold draws the generic one.
 */
export const iconName = (entry: Entry): string | undefined => entry.hints?.icon;

/**
 * drawnIcon answers "which icon may this build draw?" for a declared hint word:
 * the icon itself when the closed set holds it, nothing for any other word. The
 * catalogue's notice, a row's tile and an entry's picture all ask this one
 * question, so an unsupported word is unsupported the same way in all three.
 */
export function drawnIcon(declared: unknown): ResourceIcon | undefined {
  const word = declared as ResourceIcon;
  return resourceIcons.includes(word) ? word : undefined;
}

/** entryIcon is the picture an entry's own declared icon asks for, or nothing when it declared none this build draws. */
export function entryIcon(entry: Entry): ResourceIcon | undefined {
  return drawnIcon(iconName(entry));
}

export const pictureId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

/** pictureTemplate accepts one entire placeholder segment under the selected API origin. */
export function pictureTemplate(value: unknown, placeholder: "id" | "reference"): value is string {
  const slot = `{${placeholder}}`;
  return (
    typeof value === "string" &&
    value.startsWith("/api/v1/") &&
    value.split("/").filter((s) => s === slot).length === 1 &&
    value
      .slice(1)
      .split("/")
      .every((s) => s === slot || (/^[A-Za-z0-9_.-]+$/.test(s) && !/^\.+$/.test(s)))
  );
}

/** composedReference accepts canonical c1 tokens for 1–512 UTF-8 bytes without control characters. */
export function composedReference(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 686 || !/^c1\.[A-Za-z0-9_-]+$/.test(value))
    return false;
  const token = value.slice(3);
  if (token.length % 4 === 1) return false;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let bits = 0,
    pending = 0;
  const bytes: number[] = [];
  for (const char of token) {
    pending = (pending << 6) | alphabet.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((pending >> bits) & 255);
      pending &= (1 << bits) - 1;
    }
  }
  if (pending !== 0 || bytes.length < 1 || bytes.length > 512) return false;
  try {
    const key = decodeURIComponent(
      bytes.map((byte) => `%${byte.toString(16).padStart(2, "0")}`).join(""),
    );
    return !/[\u0000-\u001f\u007f-\u009f]/.test(key);
  } catch {
    return false;
  }
}

/** pictureDoor normalizes independent optional doors; a defective member disables only that door. */
export function pictureDoor(raw: unknown, notice: HintNotice): Pictures | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    notice("pictures", "is not a picture declaration: pictures are not loaded");
    return undefined;
  }
  const block = raw as Record<string, unknown>;
  const door = (member: "source" | "composedSource", slot: "id" | "reference") => {
    const value = block[member];
    if (value == null || value === "") return undefined;
    if (pictureTemplate(value, slot)) return value;
    notice(
      `pictures.${member}`,
      "is not a supported relative picture template: this door is not loaded",
    );
    return undefined;
  };
  const source = door("source", "id");
  const composedSource = door("composedSource", "reference");
  if (!source && !composedSource) return undefined;
  const doors = { ...(source ? { source } : {}), ...(composedSource ? { composedSource } : {}) };
  const widths = block.widths;
  if (!source || widths == null || (Array.isArray(widths) && widths.length === 0)) return doors;
  if (
    !Array.isArray(widths) ||
    !widths.every((w, i) => Number.isSafeInteger(w) && w > 0 && (i === 0 || w > widths[i - 1]))
  ) {
    notice("pictures.widths", "is not an ascending set of positive widths: the original is used");
    return doors;
  }
  return { ...doors, widths };
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
/** pictureState reads one slot's load state: its own first, then the file's, then still loading. */
export const pictureState = (
  id: string,
  instance: string,
  states: PictureStates,
): "loading" | "ready" | "error" =>
  states[JSON.stringify([id, instance])] ?? states[id] ?? "loading";

/**
 * FileMeta is what a phone keeps of one `file` row for the sake of drawing it: the frame
 * the server probed (a side of 0 says it never did), the caption, and whether the image
 * carries information at all. Nothing else a file row holds is a picture's business.
 */
export interface FileMeta {
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly decorative: boolean;
}

/** fileMeta reads those four out of a row as it arrived, refusing a side that is not a count of pixels. */
export function fileMeta(row: Readonly<Record<string, unknown>> | undefined): FileMeta {
  const side = (v: unknown) => (Number.isSafeInteger(v) && (v as number) > 0 ? (v as number) : 0);
  return {
    width: side(row?.width),
    height: side(row?.height),
    alt: typeof row?.alt === "string" ? row.alt : "",
    decorative: row?.decorative === true,
  };
}
/** noMeta is a file this phone has read nothing about yet: the picture is still drawn. */
export const noMeta: FileMeta = { width: 0, height: 0, alt: "", decorative: false };
/** PictureFrame is the geometry a slot stands in, which is the frame a picture with no stored one is drawn in. */
export interface PictureFrame {
  readonly width: number;
  readonly height: number;
}
/** FramedPicture is one file as a surface draws it: the item a model validates, and the slot a renderer is handed. */
export interface FramedPicture {
  readonly item: MediaItem;
  readonly slot: ImageSlotProps;
}

/**
 * filePicture is one file a record draws, from the metadata the picture door read for it.
 *
 * A file the server never probed carries no frame, so the picture is drawn in the frame this
 * slot declared and cropped to it (`fit: "cover"`): the phone chooses the crop rather than
 * guessing an aspect from a name or a content type, and the viewer letterboxes what it opens.
 * A picture nobody captioned is drawn and not opened — this phone holds no words for it, so a
 * reader is not asked to press it and no name is invented for it.
 */
export function filePicture(
  id: string,
  instance: string,
  meta: FileMeta,
  state: "loading" | "ready" | "error",
  frame: PictureFrame,
): FramedPicture {
  const width = Math.round(meta.width || frame.width);
  const height = Math.round(meta.height || frame.height);
  const caption = meta.alt.trim();
  const decorative = meta.decorative || caption === "";
  return {
    item: {
      id,
      width,
      height,
      description: caption,
      decorative,
      state,
    },
    slot: {
      id,
      instance: JSON.stringify([id, instance]),
      description: caption,
      decorative,
      fit: "cover",
      aspectRatio: width / height,
      caption: false,
    },
  };
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
    state: pictureState(id, instance, states),
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
