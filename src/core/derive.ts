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

/** text is a value as a control reads it: the raw spelling. */
export function text(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(text).join(", ");
  return "";
}

/** display is a value as a person reads it; nothing at all is a dash. */
export function display(f: Field, v: unknown): string {
  if (f.type === "bool") return v === true ? "Yes" : "No";
  if (f.type === "time") {
    const raw = text(v);
    const at = raw ? new Date(raw) : null;
    if (at && !Number.isNaN(at.getTime())) {
      const p = (n: number) => String(n).padStart(2, "0");
      return `${at.getUTCFullYear()}-${p(at.getUTCMonth() + 1)}-${p(at.getUTCDate())} ${p(at.getUTCHours())}:${p(at.getUTCMinutes())}`;
    }
    return raw || "—";
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
      case "number":
        if (raw !== "") out[c.field.name] = Number(raw);
        break;
      case "list":
        out[c.field.name] =
          raw === ""
            ? []
            : raw
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
        break;
      default:
        if (raw !== "" || c.required) out[c.field.name] = raw;
    }
  }
  return out;
}

/** screenPath is where the router serves an entry's screens. */
export const screenPath = (e: Entry): string => `/${e.module}/${e.entity}`;
