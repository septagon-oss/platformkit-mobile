// catalog.ts is the seam: the JSON GET /api/v1/app/resources answers, as
// types, and one validator that refuses a document the shell cannot render
// from — by the path of the first field that is wrong, so a server change is
// one line to read rather than a screen that is mysteriously empty.
//
// It mirrors kit/crud.Schema and ui/screens.Entry in the public repository.
// testdata/catalog.json is that repository's golden file, and
// testdata/catalog.source.json names the commit it was taken from: one copy,
// from one revision, with the two compared by `scripts/catalog.ts check` on
// every run rather than trusted because nobody looked.

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
 */
export interface Command {
  readonly verb: string;
  readonly summary?: string;
  readonly description?: string;
  /** collection says the command is about the whole list, so it takes no row. */
  readonly collection?: boolean;
  /**
   * path is where the command is answered: the whole endpoint, `{id}` and verb
   * included, printed only when {entry.path}/{id}/{verb} — or
   * {entry.path}/{verb} when collection — is no longer where the server mounted
   * it. Absent means the derivation still holds, so the phone derives it; a
   * printed path already ends in the verb and is never extended with it again.
   */
  readonly path?: string;
  /** fields is the shape of the argument; a command that takes none has no fields. */
  readonly fields: readonly Field[];
}

/**
 * CRUD_VERBS are the verbs the kernel counts operations in
 * (kit/httpx/operations.go). They are spelled here because the document names
 * them, not because the phone has five methods: a verb this list does not hold
 * is a document this build refuses rather than one it quietly offers.
 */
export const CRUD_VERBS = ["list", "read", "create", "update", "delete"] as const;
export type CrudVerb = (typeof CRUD_VERBS)[number];

export interface Entry {
  readonly module: string;
  readonly entity: string;
  readonly path: string;
  readonly fields: readonly Field[];
  readonly immutable: readonly string[];
  readonly writable: boolean;
  /**
   * writePath is where the writes of this resource are answered, printed only
   * when they are answered somewhere other than path — a control plane whose
   * reads sit behind one host and its writes behind another. Absent means
   * path, and it is never a permission: the server prints it only for a caller
   * that may write, so its absence says nothing about whether one may.
   */
  readonly writePath?: string;
  /**
   * operations names the verbs this resource offers. Absent, or an empty list,
   * means all five — kit/rest's own rule — so a document that says nothing is
   * read exactly as it always was.
   */
  readonly operations?: readonly CrudVerb[];
  /** commands is empty for an entity that has none, and for a server too old to say. */
  readonly commands: readonly Command[];
  /**
   * singleton says a tenant has exactly one of these, at the path itself: a
   * GET and a PUT, with no list, no id, no create and no delete. A shell that
   * ignored it would draw a list of one row with a New button on it and no
   * route to serve either.
   */
  readonly singleton: boolean;
}

/**
 * SUPPORTED_CATALOG_VERSION is the newest document shape this build can render.
 *
 * The server stamps `catalogVersion` on every answer precisely so a phone can
 * notice a shape it was not written for, and a phone is the one client that
 * cannot be redeployed at the moment the server changes: the answer it is parsed
 * from is in somebody's pocket weeks after the build that reads it. So the number
 * is checked rather than logged. It goes up in this file only when the shell has
 * learned to render the new shape, which is the same rule the server applies from
 * its side, and the two numbers meeting in the middle is the whole contract.
 */
export const SUPPORTED_CATALOG_VERSION = 2;

export interface Catalog {
  /**
   * version is the stamped shape, or 0 for a server old enough not to stamp one —
   * which is the shape every screen here was written against anyway.
   */
  readonly version: number;
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

/**
 * absolute reads an address shaped like one of this app's own. Every path the
 * document prints — the read path, the write path, a command's own endpoint —
 * passes through here, so a relative one names its field at the document rather
 * than reaching a screen to be resolved against whatever the request happened to
 * be built on. This is the document-shape half of the address rule only: whether
 * a path is sendable at all — under `/api/v1/`, no fragment, no backslash,
 * fully encoded — is one rule with one owner, the guard inside `createApi` in
 * src/effects/api.ts, and a document printing `/elsewhere` or `//example/x` is
 * refused there, before any request leaves. Carrying that half in here would be
 * a second copy of a URL rule in a layer that names no transport.
 */
function absolute(
  o: Record<string, unknown>,
  key: string,
  at: string,
  required: boolean,
): string | undefined {
  const v = str(o, key, at, required);
  if (v === undefined || v.startsWith("/")) return v;
  throw new CatalogError(`${at}.${key}`, `is ${JSON.stringify(v)}, not an absolute path`);
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
    ...opt("path", absolute(v, "path", at, false)),
    fields: (fields ?? []).map((f, i) => field(f, `${at}.fields[${i}]`)),
  };
}

function entry(v: unknown, at: string): Entry {
  if (!isRecord(v)) throw new CatalogError(at, "is not an object");
  const module = str(v, "module", at, true)!;
  const entity = str(v, "entity", at, true)!;
  const path = absolute(v, "path", at, true)!;
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
    ...opt("writePath", absolute(v, "write_path", at, false)),
    ...opt("operations", verbs(v, "operations", at)),
    commands: (commands ?? []).map((c, i) => command(c, `${at}.commands[${i}]`)),
    singleton: bool(v, "singleton", at) ?? false,
  };
}

/** parseCatalog is the only way a Catalog is made from bytes. */
export function parseCatalog(input: unknown): Catalog {
  if (!isRecord(input)) throw new CatalogError("document", "is not an object");
  const version = catalogVersion(input.catalogVersion);
  const resources = input.resources;
  if (!Array.isArray(resources)) throw new CatalogError("resources", "is not a list");
  return { version, resources: resources.map((r, i) => entry(r, `resources[${i}]`)) };
}

/**
 * catalogVersion decides what a build does with the stamp, and the three cases
 * are not symmetric:
 *
 * - absent is 0: a server predating the field is a server this shell was built
 *   against, and refusing it would turn an old deployment into a broken app.
 * - anything that is not a whole positive number is refused. A stamp written as
 *   "2" or 1.5 is a server that changed what the field *means*, which is the
 *   event this field exists to catch — so a strange stamp is not repaired, any
 *   more than a strange `type` is.
 * - a number beyond SUPPORTED_CATALOG_VERSION is refused rather than rendered as
 *   far as it is recognised. A field this build has never read is a field it will
 *   silently drop, and a screen that quietly loses the column a person came for is
 *   worse than the error: it looks like the data is gone.
 */
function catalogVersion(v: unknown): number {
  if (v === undefined) return 0;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) {
    throw new CatalogError("catalogVersion", `is ${JSON.stringify(v)}, not a whole version`);
  }
  if (v > SUPPORTED_CATALOG_VERSION) {
    throw new CatalogError(
      "catalogVersion",
      `is ${v}; this build renders up to ${SUPPORTED_CATALOG_VERSION} and would draw screens from fields it cannot see`,
    );
  }
  return v;
}

/**
 * verbs reads an operation set: the words CRUD_VERBS holds, each at most once.
 * An empty list is kept as an empty list — the parser invents no value the
 * document did not print — and means all five in `offers`. A repeated word is
 * a server that mounted the same verb twice, so it is refused here rather than
 * read as a shorter set.
 */
function verbs(
  o: Record<string, unknown>,
  key: string,
  at: string,
): readonly CrudVerb[] | undefined {
  const listed = strings(o, key, at);
  if (listed === undefined) return undefined;
  return listed.map((word, i) => {
    if (!(CRUD_VERBS as readonly string[]).includes(word)) {
      throw new CatalogError(
        `${at}.${key}[${i}]`,
        `is ${JSON.stringify(word)}, not one of ${CRUD_VERBS.join(", ")}`,
      );
    }
    if (listed.indexOf(word) !== i) {
      throw new CatalogError(`${at}.${key}`, `names ${JSON.stringify(word)} twice`);
    }
    return word as CrudVerb;
  });
}

/** key is how a renderer pack names a resource: "module/entity". */
export const key = (e: Entry): string => `${e.module}/${e.entity}`;

/**
 * offers reports whether this entry names a verb. No set, and an empty set,
 * are both "all five", which is why a v1 document needs no re-stamping to keep
 * every door it always had.
 */
export const offers = (e: Entry, verb: CrudVerb): boolean =>
  e.operations === undefined || e.operations.length === 0 || e.operations.includes(verb);

/**
 * Doors are the write controls an entry may draw. `writable` says this caller
 * may write at all; `operations` says which doors the server actually mounted.
 * Neither decides alone, so no screen reads either one by itself: a caller who
 * may write gets no New button on a resource with no create, and a resource
 * with create gets none for a caller who may not.
 */
export interface Doors {
  readonly create: boolean;
  readonly update: boolean;
  readonly delete: boolean;
}

export const doors = (e: Entry): Doors => ({
  create: e.writable && offers(e, "create"),
  update: e.writable && offers(e, "update"),
  delete: e.writable && offers(e, "delete"),
});
