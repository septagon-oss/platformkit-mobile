// derive.ts is ADR 0007 on a phone: what a list, a detail and a form are, given
// only an entry's schema. The rules are the web generator's (ui/screens in the
// public repository), restated in one place so the two shells agree — a status
// is "Open" in a cell there and in a cell here.
import type { Entry, Field } from "./catalog";

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

/** plural is a screen's name for many of an entity: "task" is "tasks", "settings" is "settings". */
export function plural(noun: string): string {
  return noun.endsWith("s") ? noun : noun + "s";
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

// timeText is an instant as a person reads it here: in the device's zone, with
// the zone named, because a phone is somewhere. This is the one place the
// native shell reads differently from the web shell's UTC cell, on purpose:
// a browser tab is a desk, a phone is a person.
// The formatter is remade when the device's zone changes, because a phone
// that flies keeps running.
let timeFormat: Intl.DateTimeFormat | undefined;
let timeZone: string | undefined;
export function timeText(at: Date): string {
  const now = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!timeFormat || now !== timeZone) {
    timeZone = now;
    timeFormat = new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }
  return timeFormat.format(at);
}

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
export function display(f: Field, v: unknown): string {
  if (f.type === "bool") return v === true ? "Yes" : "No";
  if (f.type === "time") {
    const at = timeValue(v);
    return at ? timeText(at) : text(v) || "—";
  }
  const out = text(v);
  if (!out) return "—";
  return f.enum && f.enum.length > 0 ? humanize(out) : out;
}

/** known is the field a row is recognised by: the first writable string. */
export function known(fields: readonly Field[]): Field {
  return (
    fields.find((f) => !f.readOnly && f.type === "string") ??
    fields[0] ?? { name: "id", type: "uuid" }
  );
}

export function label(e: Entry, row: Row): string {
  return text(row[known(e.fields).name]) || text(row.id);
}

/** listColumns: the known field first, then every field the schema does not hide; never the id. */
export function listColumns(e: Entry): readonly Field[] {
  const primary = known(e.fields);
  return [
    primary,
    ...e.fields.filter((f) => !f.hideList && f.name !== primary.name && f.name !== "id"),
  ];
}

export interface DetailItem {
  readonly label: string;
  readonly value: string;
}

export function detailItems(e: Entry, row: Row): readonly DetailItem[] {
  return e.fields.map((f) => ({ label: humanize(f.name), value: display(f, row[f.name]) }));
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

/** formControls: one control per writable field; immutable fields are read-only on edit and absent on create. */
export function formControls(e: Entry, row: Row | undefined, create: boolean): readonly Control[] {
  const out: Control[] = [];
  for (const f of e.fields) {
    if (f.readOnly) continue;
    const immutable = e.immutable.includes(f.name);
    if (create && immutable) continue;
    const k = kind(f);
    const value = row && f.name in row ? text(row[f.name]) : create ? (f.default ?? "") : "";
    const notes = [f.doc ?? ""];
    if (immutable) notes.push("Changed by a command of its own, not by this form.");
    if (k === "reference") {
      notes.push("The identifier of the related record. There is no picker for it yet.");
    }
    if (k === "list") notes.push("Comma separated.");
    out.push({
      kind: k,
      field: f,
      label: humanize(f.name),
      value,
      required: f.required === true,
      readOnly: immutable,
      help: notes.filter(Boolean).join(" "),
      options: (f.enum ?? []).map((v) => ({ value: v, label: humanize(v) })),
    });
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
      case "list":
        out[c.field.name] = splitList(raw);
        break;
      case "datetime":
        // An optional instant that was cleared is cleared on the server too:
        // leaving it out of the body would keep what is stored.
        if (raw !== "") out[c.field.name] = raw;
        else if (!c.required) out[c.field.name] = null;
        break;
      default:
        if (raw !== "" || c.required) out[c.field.name] = raw;
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
    out.push({ value: f.name, label: `${humanize(f.name)}, ascending` });
    out.push({ value: "-" + f.name, label: `${humanize(f.name)}, descending` });
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
