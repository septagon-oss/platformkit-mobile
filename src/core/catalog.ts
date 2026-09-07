// catalog.ts is the seam: the JSON GET /api/v1/admin/resources answers, as
// types, and one validator that refuses a document the shell cannot render
// from — by the path of the first field that is wrong, so a server change is
// one line to read rather than a screen that is mysteriously empty.
//
// It mirrors kit/crud.Schema and ui/screens.Entry in the public repository.
// testdata/catalog.json is that repository's golden file, copied verbatim.

export const FIELD_TYPES = [
  "string",
  "text",
  "int",
  "float",
  "bool",
  "time",
  "uuid",
  "list",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface Field {
  readonly name: string;
  readonly type: FieldType;
  readonly elem?: FieldType;
  readonly widget?: string;
  readonly enum?: readonly string[];
  readonly required?: boolean;
  readonly readOnly?: boolean;
  readonly hideList?: boolean;
  readonly default?: string;
  readonly doc?: string;
}

/**
 * Command is a door beyond the five: a rule about the state a row is in, with
 * an event of its own, which is what a form cannot express. A command the
 * caller may not call is absent from the document, so one that is here is one
 * this caller may run.
 *
 * There is no path, because it is derived the way every other path is: POST
 * {entry.path}/{id}/{verb}, or {entry.path}/{verb} when collection.
 */
export interface Command {
  readonly verb: string;
  readonly summary?: string;
  readonly description?: string;
  /** collection says the command is about the whole list, so it takes no row. */
  readonly collection?: boolean;
  /** fields is the shape of the argument; a command that takes none has no fields. */
  readonly fields: readonly Field[];
}

export interface Entry {
  readonly module: string;
  readonly entity: string;
  readonly path: string;
  readonly fields: readonly Field[];
  readonly immutable: readonly string[];
  readonly writable: boolean;
  /** commands is empty for an entity that has none, and for a server too old to say. */
  readonly commands: readonly Command[];
}

export interface Catalog {
  readonly resources: readonly Entry[];
}

export class CatalogError extends Error {
  constructor(at: string, why: string) {
    super(`catalog: ${at} ${why}`);
    this.name = "CatalogError";
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function str(
  o: Record<string, unknown>,
  key: string,
  at: string,
  required: boolean,
): string | undefined {
  const v = o[key];
  if (v === undefined) {
    if (required) throw new CatalogError(`${at}.${key}`, "is missing");
    return undefined;
  }
  if (typeof v !== "string") throw new CatalogError(`${at}.${key}`, "is not a string");
  return v;
}

function bool(o: Record<string, unknown>, key: string, at: string): boolean | undefined {
  const v = o[key];
  if (v === undefined) return undefined;
  if (typeof v !== "boolean") throw new CatalogError(`${at}.${key}`, "is not a boolean");
  return v;
}

function strings(
  o: Record<string, unknown>,
  key: string,
  at: string,
): readonly string[] | undefined {
  const v = o[key];
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.some((s) => typeof s !== "string")) {
    throw new CatalogError(`${at}.${key}`, "is not a list of strings");
  }
  return v as string[];
}

function fieldType(v: unknown, at: string): FieldType {
  if (typeof v !== "string" || !(FIELD_TYPES as readonly string[]).includes(v)) {
    throw new CatalogError(at, `type ${JSON.stringify(v)} is not one of ${FIELD_TYPES.join(", ")}`);
  }
  return v as FieldType;
}

function opt<K extends string, V>(key: K, v: V | undefined): Partial<Record<K, V>> {
  return v === undefined ? {} : ({ [key]: v } as Record<K, V>);
}

function field(v: unknown, at: string): Field {
  if (!isRecord(v)) throw new CatalogError(at, "is not an object");
  return {
    name: str(v, "name", at, true)!,
    type: fieldType(v.type, `${at}.type`),
    ...(v.elem !== undefined ? { elem: fieldType(v.elem, `${at}.elem`) } : {}),
    ...opt("widget", str(v, "widget", at, false)),
    ...opt("enum", strings(v, "enum", at)),
    ...opt("required", bool(v, "required", at)),
    ...opt("readOnly", bool(v, "readOnly", at)),
    ...opt("hideList", bool(v, "hideList", at)),
    ...opt("default", str(v, "default", at, false)),
    ...opt("doc", str(v, "doc", at, false)),
  };
}

function command(v: unknown, at: string): Command {
  if (!isRecord(v)) throw new CatalogError(at, "is not an object");
  const fields = v.fields;
  if (fields !== undefined && !Array.isArray(fields)) {
    throw new CatalogError(`${at}.fields`, "is not a list");
  }
  return {
    verb: str(v, "verb", at, true)!,
    ...opt("summary", str(v, "summary", at, false)),
    ...opt("description", str(v, "description", at, false)),
    ...opt("collection", bool(v, "collection", at)),
    fields: (fields ?? []).map((f, i) => field(f, `${at}.fields[${i}]`)),
  };
}

function entry(v: unknown, at: string): Entry {
  if (!isRecord(v)) throw new CatalogError(at, "is not an object");
  const module = str(v, "module", at, true)!;
  const entity = str(v, "entity", at, true)!;
  const path = str(v, "path", at, true)!;
  const fields = v.fields;
  if (!Array.isArray(fields)) throw new CatalogError(`${at}.fields`, "is not a list");
  const writable = bool(v, "writable", at);
  if (writable === undefined) throw new CatalogError(`${at}.writable`, "is missing");
  // Absent is none: a server that predates commands still renders every screen
  // it did before, with no door on it.
  const commands = v.commands;
  if (commands !== undefined && !Array.isArray(commands)) {
    throw new CatalogError(`${at}.commands`, "is not a list");
  }
  return {
    module,
    entity,
    path,
    fields: fields.map((f, i) => field(f, `${at}.fields[${i}]`)),
    immutable: strings(v, "immutable", at) ?? [],
    writable,
    commands: (commands ?? []).map((c, i) => command(c, `${at}.commands[${i}]`)),
  };
}

/** parseCatalog is the only way a Catalog is made from bytes. */
export function parseCatalog(input: unknown): Catalog {
  if (!isRecord(input)) throw new CatalogError("document", "is not an object");
  const resources = input.resources;
  if (!Array.isArray(resources)) throw new CatalogError("resources", "is not a list");
  return { resources: resources.map((r, i) => entry(r, `resources[${i}]`)) };
}

/** key is how a renderer pack names a resource: "module/entity". */
export const key = (e: Entry): string => `${e.module}/${e.entity}`;
