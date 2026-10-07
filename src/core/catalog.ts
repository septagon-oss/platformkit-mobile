// Generated schemas own the wire shape; this module owns the supported kinds,
// catalog version, address semantics and the native normalized view.
import { z } from "zod";
import type {
  Catalog as WireCatalog,
  Entry as WireEntry,
  Field as WireField,
  Command as WireCommand,
} from "../generated/types.gen";
import { zCatalog, zEntry } from "../generated/zod.gen";
import { issuePath } from "./responses";

// Zod retains explicitly undefined optional properties on in-memory inputs.
// Required wire members remain required; JSON itself never contains undefined.
type View<T> = Readonly<
  {
    [K in keyof T as undefined extends T[K] ? K : never]?: T[K] | undefined;
  } & {
    [K in keyof T as undefined extends T[K] ? never : K]: T[K];
  }
>;

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

export type Field = View<Omit<WireField, "type" | "elem" | "enum">> & {
  readonly type: FieldType;
  readonly elem?: FieldType;
  readonly enum?: readonly string[];
};

export type Command = View<Omit<WireCommand, "fields">> & {
  readonly fields: readonly Field[];
};

/**
 * CRUD_VERBS are the verbs the kernel counts operations in
 * (kit/httpx/operations.go). They are spelled here because the document names
 * them, not because the phone has five methods: a verb this list does not hold
 * is a document this build refuses rather than one it quietly offers.
 */
export const CRUD_VERBS = ["list", "read", "create", "update", "delete"] as const;
export type CrudVerb = (typeof CRUD_VERBS)[number];

/**
 * RendererRef is what a catalogue entry says its screen needs: which renderer
 * pack, keyed "module/entity", and the oldest shell that can draw it.
 *
 * The name is *presentation* identity, not data identity: it may point at a
 * pack under another module's key, and `key()` keeps naming the resource every
 * read, write and door is resolved against. Nothing authorises anything from
 * it — a name this build does not ship draws the generated screens.
 */
export interface RendererRef {
  readonly name: string;
  /** minShell is the lowest SHELL_VERSION whose shell can draw this pack's screen. */
  readonly minShell: number;
}

export type Entry = View<Omit<WireEntry, "fields" | "commands" | "immutable" | "singleton">> & {
  readonly fields: readonly Field[];
  readonly commands: readonly Command[];
  readonly immutable: readonly string[];
  readonly singleton: boolean;
  readonly writePath?: string;
  // Catalog v2's operations postdates this document pin. This compatibility
  // extension stays with the existing core owner, not a fabricated operation.
  readonly operations?: readonly CrudVerb[];
  // The kernel owns whether an entry names a renderer; no document pin prints
  // the key yet, so it is read as optional on the same terms as `operations`.
  readonly renderer?: RendererRef;
};

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

/**
 * SHELL_VERSION is what this build of the shell can draw.
 *
 * A renderer pack ships inside the app binary, never on the server, so this
 * number belongs to the kit rather than to a product: a product cannot claim a
 * screen-level capability the shell it composes lacks. It goes up in this file
 * when the shell gains one a pack can depend on — the first is a pack screen
 * reading typed data from a generated operation, which is why a build before
 * this one is 0 and is not shipped. It is the mirror image of
 * SUPPORTED_CATALOG_VERSION: that number is the newest *document* this build
 * can read and is refused when it is exceeded; this one is the oldest *shell*
 * a screen may ask for and falls back when it is not reached, because a screen
 * that needs more is a screen a person can get by updating the app.
 */
export const SHELL_VERSION = 1;

export type Catalog = View<Omit<WireCatalog, "catalogVersion" | "resources">> & {
  readonly version: number;
  readonly resources: readonly Entry[];
};

export class CatalogError extends Error {
  constructor(
    readonly at: string,
    why: string,
  ) {
    super(`catalog: ${at} ${why}`);
    this.name = "CatalogError";
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function absolute(value: string, at: string): string {
  if (!value.startsWith("/")) throw new CatalogError(at, "is not an absolute path");
  return value;
}

function fieldType(v: unknown, at: string): FieldType {
  if (typeof v !== "string" || !(FIELD_TYPES as readonly string[]).includes(v)) {
    throw new CatalogError(at, `type ${JSON.stringify(v)} is not one of ${FIELD_TYPES.join(", ")}`);
  }
  return v as FieldType;
}

// A renderer the entry names is presentation only, so a malformed one is read
// as none rather than refused: the whole object, or nothing. An empty name, a
// `min_shell` that is a string, 0 or 1.5, a bare `renderer: null`, all say "no
// pack was named" and leave the entry's fields, commands and path intact — a
// typewriter's slip in a screen's name may not blank an app. Unknown members
// inside a well-formed object are ignored: a key this build has never read is
// no reason to lose a screen. It enters the parser as `unknown` for that
// reason — the shape is decided below, not by a schema nothing consulted.
const catalogSchema = zCatalog.extend({
  resources: z
    .array(
      zEntry.extend({
        operations: z.array(z.string()).optional(),
        renderer: z.unknown().optional(),
      }),
    )
    .nullable(),
});

/** rendererRef reads which pack an entry asks for, or says that it asks for none. */
function rendererRef(v: unknown): RendererRef | undefined {
  if (!isRecord(v)) return undefined;
  const name = v.name;
  const minShell = v.min_shell;
  if (typeof name !== "string" || name === "") return undefined;
  if (typeof minShell !== "number" || !Number.isInteger(minShell) || minShell < 1) return undefined;
  return { name, minShell };
}

type ParsedEntry = NonNullable<z.output<typeof catalogSchema>["resources"]>[number];
function field(v: View<WireField>, at: string): Field {
  const { type, elem, enum: values, ...rest } = v;
  return {
    ...rest,
    type: fieldType(type, `${at}.type`),
    ...(elem === undefined ? {} : { elem: fieldType(elem, `${at}.elem`) }),
    ...(values == null ? {} : { enum: values }),
  };
}

function entry(v: ParsedEntry, at: string): Entry {
  const { fields, commands, immutable, operations, renderer, singleton, ...rest } = v;
  const pack = rendererRef(renderer);
  return {
    ...rest,
    path: absolute(v.path, `${at}.path`),
    ...(pack === undefined ? {} : { renderer: pack }),
    ...(v.write_path === undefined
      ? {}
      : { writePath: absolute(v.write_path, `${at}.write_path`) }),
    fields: (fields ?? []).map((f, i) => field(f, `${at}.fields[${i}]`)),
    immutable: immutable ?? [],
    ...(operations === undefined ? {} : { operations: verbs(operations, `${at}.operations`) }),
    commands: (commands ?? []).map(({ fields, path, ...command }, i) => ({
      ...command,
      ...(path === undefined ? {} : { path: absolute(path, `${at}.commands[${i}].path`) }),
      fields: (fields ?? []).map((f, n) => field(f, `${at}.commands[${i}].fields[${n}]`)),
    })),
    singleton: singleton ?? false,
  };
}

/** parseCatalog is the only way a Catalog is made from bytes. */
export function parseCatalog(input: unknown): Catalog {
  if (!isRecord(input)) throw new CatalogError("document", "is not an object");
  const version = catalogVersion(input.catalogVersion);
  const result = catalogSchema.safeParse({ ...input, catalogVersion: version });
  if (!result.success) {
    const issue = result.error.issues[0]!;
    const at = issuePath(result.error);
    const why =
      issue.code === "invalid_type" && issue.expected === "string"
        ? "is not a string"
        : at.endsWith(".operations")
          ? "is not a list of strings"
          : "failed validation";
    throw new CatalogError(at, why);
  }
  const { resources, catalogVersion: _stamp, ...metadata } = result.data;
  return {
    ...metadata,
    version,
    resources: (resources ?? []).map((r, i) => entry(r, `resources[${i}]`)),
  };
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
function verbs(listed: readonly string[], at: string): readonly CrudVerb[] {
  return listed.map((word, i) => {
    if (!(CRUD_VERBS as readonly string[]).includes(word))
      throw new CatalogError(
        `${at}[${i}]`,
        `is ${JSON.stringify(word)}, not one of ${CRUD_VERBS.join(", ")}`,
      );
    if (listed.indexOf(word) !== i)
      throw new CatalogError(at, `names ${JSON.stringify(word)} twice`);
    return word as CrudVerb;
  });
}

/** key is how a renderer pack names a resource: "module/entity". */
export const key = (e: Entry): string => `${e.module}/${e.entity}`;

/**
 * packKey is the pack this entry asks for: the one it names, else the key of
 * the resource itself. Data identity never moves here — every request still
 * goes to `entry.path` — which is what lets one module ship a screen another
 * module's entry asks for.
 */
export const packKey = (e: Entry): string => e.renderer?.name ?? key(e);

/**
 * shellReady says whether this build can draw the pack the entry names. An
 * entry that names no pack needs nothing; one that needs a newer shell is
 * drawn by the generated screens, which is a fallback, not a refusal.
 */
export const shellReady = (e: Entry): boolean =>
  e.renderer === undefined || e.renderer.minShell <= SHELL_VERSION;

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
