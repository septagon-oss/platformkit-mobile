// derive.ts is ADR 0007 on a phone: what a list, a detail and a form are, given
// only an entry's schema. The rules are the web generator's (ui/screens in the
// public repository), restated in one place so the two shells agree — a status
// is "Open" in a cell there and in a cell here.
import type { Command, CrudVerb, Entry, Field } from "./catalog";
import { presentedTime, type Formatting } from "./presentation";

export { deriveCopy, type Copy, type Language } from "./copy";
export { stateExamples, type StateExample } from "./stateGallery";
export {
  deriveFeedback,
  instantValue,
  presentedTime,
  type Clock,
  type Feedback,
  type Formatting,
  type Instant,
  type Issue,
  type IssueCode,
  type Motion,
  type Presentation,
  type Result,
} from "./presentation";
export {
  deriveState,
  retry,
  readPhase,
  type Action,
  type Announcement,
  type SkeletonVariant,
  type StateAction,
  type StateInput,
  type StateModel,
} from "./feedback";

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

/** Existing entry point; dates have one formatter with explicit locale and zone. */
export const timeText = presentedTime;

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
export function display(f: Field, v: unknown, format: Formatting): string {
  if (f.type === "bool") return v === true ? format.copy.value.yes : format.copy.value.no;
  if (f.type === "time") {
    const at = timeValue(v);
    return at ? timeText(at, format) : text(v) || "—";
  }
  if ((f.type === "int" || f.type === "float") && typeof v === "number" && Number.isFinite(v))
    return new Intl.NumberFormat(format.locale, { maximumSignificantDigits: 21 }).format(v);
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

/**
 * listCells are the few fields a row shows beneath its name. A table has a
 * header and room for every column; a row on a phone has one line, so it
 * shows what tells two records apart first: a closed set of values, then a
 * yes or no, then a number, then words, and only then the times and
 * identifiers every record has and few people scan for.
 */
export function listCells(e: Entry, limit = 3): readonly Field[] {
  const rank = (f: Field): number => {
    if (f.enum && f.enum.length > 0) return 0;
    if (f.type === "bool") return 1;
    if (f.type === "int" || f.type === "float") return 2;
    if (f.type === "list") return 3;
    if (f.type === "string" || f.type === "text") return 4;
    if (f.type === "time") return 5;
    return 6;
  };
  const primary = known(e.fields);
  const preview = listPreview(e);
  return listColumns(e)
    .filter((f) => f.name !== primary.name && f.name !== preview?.name)
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .slice(0, limit)
    .map(({ f }) => f);
}

/**
 * listPreview is the field a row shows a line of under its name: the first
 * long text the entity has, which is what a person reads to recognise the
 * record.
 *
 * `hide:list` does not disqualify it. That tag says a value does not belong
 * in a table column, which is true of every long text and is why a schema
 * marks them: a paragraph ruins a column. A line under the name is not a
 * column, and the paragraph is exactly what is worth reading there. It stays
 * out of the cells beside it, which are columns.
 */
export function listPreview(e: Entry): Field | undefined {
  const primary = known(e.fields);
  return e.fields.find(
    (f) => f.name !== primary.name && !f.readOnly && (f.type === "text" || f.widget === "textarea"),
  );
}

export interface DetailItem {
  /** field is the schema entry this fact is about, as `Control.field` is. */
  readonly field: Field;
  readonly label: string;
  readonly value: string;
}

export function detailItems(e: Entry, row: Row, format: Formatting): readonly DetailItem[] {
  return e.fields.map((f) => ({
    field: f,
    label: humanize(f.name),
    value: display(f, row[f.name], format),
  }));
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

/** control is one field as a form holds it: the same rules wherever the field came from. */
function control(f: Field, value: string, immutable: boolean): Control {
  const k = kind(f);
  const notes = [f.doc ?? ""];
  if (immutable) notes.push("Changed by a command of its own, not by this form.");
  if (k === "reference") {
    notes.push("The identifier of the related record. There is no picker for it yet.");
  }
  if (k === "list") notes.push("Comma separated.");
  return {
    kind: k,
    field: f,
    label: humanize(f.name),
    value,
    required: f.required === true,
    readOnly: immutable,
    help: notes.filter(Boolean).join(" "),
    options: (f.enum ?? []).map((v) => ({ value: v, label: humanize(v) })),
  };
}

/** formControls: one control per writable field; immutable fields are read-only on edit and absent on create. */
export function formControls(e: Entry, row: Row | undefined, create: boolean): readonly Control[] {
  const out: Control[] = [];
  for (const f of e.fields) {
    if (f.readOnly) continue;
    const immutable = e.immutable.includes(f.name);
    if (create && immutable) continue;
    const value = row && f.name in row ? text(row[f.name]) : create ? (f.default ?? "") : "";
    out.push(control(f, value, immutable));
  }
  return out;
}

/**
 * commandControls is a command's argument as a form: the same controls a field
 * of the entity gets, because a command's argument is described the same way.
 * A command that takes no argument has none, which is what makes it a
 * confirmation rather than a sheet.
 */
export function commandControls(c: Command): readonly Control[] {
  return c.fields.map((f) => control(f, f.default ?? "", false));
}

/**
 * commandTitle is what a person taps: the summary the API document gives, or
 * the verb spelled as words when it gives none.
 */
export const commandTitle = (c: Command): string => c.summary || humanize(c.verb);

/** rowCommands are the commands about one record; collectionCommands are about the list. */
export const rowCommands = (e: Entry): readonly Command[] =>
  e.commands.filter((c) => !c.collection);
export const collectionCommands = (e: Entry): readonly Command[] =>
  e.commands.filter((c) => c.collection === true);

/**
 * CommandScope is the address a command was opened at, which is the whole of
 * what "about one record" and "about the collection" mean on screen: the
 * address either has a row to name or it does not.
 *
 * The command and the address have to agree, because the POST is derived from
 * both — `{entry.path}/{id}/{verb}`, or `{entry.path}/{verb}` when collection
 * (catalog.Command). A record command opened at the collection's address would
 * POST to the address only a collection command mounts, and a collection command
 * opened at a record's would name a row to a door that takes none. The sheet is
 * drawn from the catalog alone, so nothing else would notice until the write
 * came back 404 with the argument somebody typed still in the box.
 *
 * The test is the one `api.command` already makes of the id it is handed
 * (`id ? path/id : path`); naming it here is what lets the screen refuse before
 * anybody fills in a sheet. The two screens that *navigate* to these addresses
 * already scope themselves (`rowCommands` from a record, `collectionCommands`
 * from a list): only an address typed or deep-linked from outside can mismatch.
 */
export type CommandScope = "record" | "collection";

/** commandAt says whether a command belongs at an address; otherScope is the other one. */
export const commandAt = (c: Command, at: CommandScope): boolean =>
  at === "collection" ? c.collection === true : !c.collection;

export const otherScope = (at: CommandScope): CommandScope =>
  at === "record" ? "collection" : "record";

/** commandScope is the address a route holds: with a row in the path, a record's. */
export const commandScope = (id: string | undefined): CommandScope =>
  id ? "record" : "collection";

/** commandOf finds the command a route's verb names at the address it was opened at. */
export const commandOf = (e: Entry, verb: string, at: CommandScope): Command | undefined =>
  e.commands.find((c) => c.verb === verb && commandAt(c, at));

/** listValues retains the element types the server declared, or refuses the whole list. */
function listValues(field: Field, raw: string): (string | number | boolean)[] | undefined {
  const out: (string | number | boolean)[] = [];
  for (const item of splitList(raw)) {
    if (field.elem === "int" || field.elem === "float") {
      const syntax =
        field.elem === "int" ? /^[+-]?\d+$/ : /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
      if (!syntax.test(item)) return undefined;
      const n = Number(item);
      if (!Number.isFinite(n) || (field.elem === "int" && !Number.isSafeInteger(n)))
        return undefined;
      out.push(n);
    } else if (field.elem === "bool") {
      if (item !== "true" && item !== "false") return undefined;
      out.push(item === "true");
    } else out.push(item);
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
      case "list": {
        const list = listValues(c.field, raw);
        if (list !== undefined) out[c.field.name] = list;
        break;
      }
      case "datetime":
        // An optional instant that was cleared is cleared on the server too:
        // leaving it out of the body would keep what is stored.
        if (raw !== "") out[c.field.name] = raw;
        else if (!c.required) out[c.field.name] = null;
        break;
      default:
        // An untouched optional blank stays absent; clearing existing text is
        // an explicit empty value, so PATCH does not retain the saved text.
        if (
          raw !== "" ||
          c.required ||
          ((c.field.type === "string" || c.field.type === "text") && c.value !== "")
        )
          out[c.field.name] = raw;
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
    if (c.kind === "list" && listValues(c.field, raw) === undefined)
      out[c.field.name] = "contains a value that does not match its item type";
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

/**
 * writePath is where an entry's writes are answered: POST, PATCH, PUT and
 * DELETE go here, GETs go to `path`. Most resources answer both at the same
 * address and print no `write_path`; the one that does — a control plane whose
 * writes are mounted on another surface — is not something a screen or a
 * transport gets to guess at.
 */
export const writePath = (e: Entry): string => e.writePath ?? e.path;

/** rowPlaceholder is the literal the kernel leaves in a printed command path. */
const rowPlaceholder = "{id}";

/**
 * verbRefusal is what a screen says when it is asked to send a verb the
 * resource does not mount. The door for such a verb is never drawn, so this is
 * the sentence for a sheet reached by a link or a stale notification rather
 * than for a choice somebody was offered — and the request itself is refused
 * before it is built, because the address it would go to is not there.
 */
export const verbRefusal = (verb: CrudVerb): string =>
  verb === "create"
    ? "This record cannot be created here."
    : verb === "update"
      ? "This record cannot be edited here."
      : verb === "delete"
        ? "This record cannot be deleted here."
        : "This is not available here.";

/**
 * commandPath is where a command is POSTed. The kernel prints an address only
 * when {entry.path}/{id}/{verb} — or {entry.path}/{verb} for a command about
 * the collection — is no longer where it mounted the verb, so a printed path is
 * the whole endpoint and already ends in the verb: it is used as it is read,
 * with the row substituted and the verb never appended again.
 */
export const commandPath = (e: Entry, verb: string, id?: string): string => {
  const printed = e.commands.find((c) => c.verb === verb)?.path;
  if (printed === undefined) {
    const at = id ? `${e.path}/${encodeURIComponent(id)}` : e.path;
    return `${at}/${encodeURIComponent(verb)}`;
  }
  if (!printed.includes(rowPlaceholder)) return printed;
  if (id === undefined) {
    throw new TypeError(`command "${verb}" is answered at ${printed}, which needs the row`);
  }
  return printed.split(rowPlaceholder).join(encodeURIComponent(id));
};

export * from "./collections";
export * from "./surfaces";
export * from "./audit";
export * from "./stepper";
export * from "./slots";
export * from "./calendar";
export * from "./commerce";
export * from "./pricing";
export * from "./map";
export * from "./media";
export * from "./charts";
export * from "./table";
export type { Content, ContentModel, Page, Status, Control as ActionModel } from "./shared";

export * from "./catalogActivity";
export * from "./catalogList";
export { kitExamples, kitCaseIds, type KitExamples, type GallerySelection } from "./kitGallery";
