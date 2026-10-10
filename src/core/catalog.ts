// Generated schemas own the wire shape; this module owns the supported kinds,
// catalog version, address semantics and the native normalized view.
import { z } from "zod";
import type {
  Catalog as WireCatalog,
  Entry as WireEntry,
  Field as WireField,
  Command as WireCommand,
} from "../generated/types.gen";
import { zCatalog, zCommand, zEntry, zField } from "../generated/zod.gen";
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

export type Field = View<Omit<WireField, "type" | "elem" | "enum" | "presentation">> & {
  readonly type: FieldType;
  readonly elem?: FieldType;
  readonly enum?: readonly string[];
  readonly hints?: FieldHints;
};

export type Command = View<Omit<WireCommand, "fields" | "presentation">> & {
  readonly fields: readonly Field[];
  readonly hints?: CommandHints;
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

export type Entry = View<
  Omit<WireEntry, "fields" | "commands" | "immutable" | "singleton" | "operations" | "presentation">
> & {
  readonly fields: readonly Field[];
  readonly commands: readonly Command[];
  readonly immutable: readonly string[];
  readonly singleton: boolean;
  readonly writePath?: string;
  // Catalog v2's operations postdates the pin this document was cut from, and the
  // core re-spells the list as the five verbs the kernel counts, so the wire shape
  // is omitted from the view rather than passed through: the value in the model is
  // this build's reading, not the document's bytes.
  readonly operations?: readonly CrudVerb[];
  // The kernel owns whether an entry names a renderer; it is read as `unknown`
  // so that a malformed name costs a pack and not a screen.
  readonly renderer?: RendererRef;
  readonly hints?: EntryHints;
};

/**
 * HintTone is the kernel's tone vocabulary (`kit/entity.Tones`). It is spelled
 * here because a shared model may not import a drawing: `ui/atoms/Badge.tsx`
 * calls the same colour `ok`, and the mapping is written once, where it is read.
 */
export type HintTone = "neutral" | "info" | "success" | "warning" | "danger";

/** FieldVisibility is `kit/entity.Visibilities`. Absent means `shown` and is not stored. */
export type FieldVisibility = "shown" | "detail" | "hidden";

/**
 * EntryHints, FieldHints and CommandHints are the phone's reading of the
 * catalogue's `presentation` objects. The wire key stays `presentation`; the
 * core field is `hints`, named after the kernel's own `kit/entity/hints.go`,
 * because `src/core/presentation.ts` already owns the word *Presentation* for
 * the reader's locale bundle. Only the members this build reads are stored, and
 * each is absent rather than `undefined`, so `Object.keys` lists what the
 * document declared.
 */
export interface EntryHints {
  readonly singular?: string;
  readonly plural?: string;
  readonly icon?: string;
  readonly primaryField?: string;
  readonly previewField?: string;
  readonly summaryFields?: readonly string[];
  readonly statusField?: string;
  /**
   * sortable names the fields a list may be ordered by, in the order its sheet
   * lists them. It is the kernel's own member (`kit/entity`), read here so no
   * component reaches past the parser into the generated wire type; absent means
   * the sheet answers with the field the entry leads rows with plus the date
   * fields it declares (`sortFields`).
   */
  readonly sortable?: readonly string[];
  readonly sections?: readonly { readonly key: string; readonly label: string }[];
}

export interface FieldHints {
  readonly label?: string;
  readonly help?: string;
  /** section names a key of the owning entry's declared sections. */
  readonly section?: string;
  readonly visibility?: FieldVisibility;
  readonly enumLabels?: Readonly<Record<string, string>>;
  readonly enumTones?: Readonly<Record<string, HintTone>>;
}

export interface CommandHints {
  readonly label?: string;
  /** system is stored only when declared true: the kernel prints no key for a
   * false one, so silence and false are one reading and need no member. */
  readonly system?: true;
}

/**
 * HintNotice is how a hint defect reaches a developer. `at` is the document path
 * of the hint and `why` names the default now in use. Core calls what it is
 * handed and keeps no state: the core has no console (AGENTS.md), and a person
 * is never told about an author's typo. "Logged once" means once per distinct
 * (path, reason) per parse — the caller owns the set.
 */
export type HintNotice = (at: string, why: string) => void;

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
// A presentation hint is the one optional this build must not let a strict
// schema decide: `additionalProperties: false` would make a mistyped noun the
// reason the whole catalogue is refused — every screen in the workspace lost to
// one typo in one label. The brief forbids that, so the hint enters as
// `unknown` and hintEntry/hintField/hintCommand below decide its shape, exactly
// as `renderer` does above. The generated `appResources` operation keeps its
// strict validator: that refusal belongs to the public contract, not to a pocket.
// Only `presentation` is re-declared, and where a hint sits inside a nested
// list the list is re-declared to hold the loose element — with the optionality
// the generated schema gives it (`nullish` where the document says a server may
// print no key, `nullable` where it must print one), so loosening a hint cannot
// quietly make a wire member required or optional.
const looseField = zField.extend({ presentation: z.unknown().optional() });
const looseCommand = zCommand.extend({
  fields: z.array(looseField).nullish(),
  presentation: z.unknown().optional(),
});

const catalogSchema = zCatalog.extend({
  resources: z
    .array(
      zEntry.extend({
        operations: z.array(z.string()).optional(),
        renderer: z.unknown().optional(),
        presentation: z.unknown().optional(),
        fields: z.array(looseField).nullable(),
        commands: z.array(looseCommand).nullish(),
      }),
    )
    .nullable(),
});

const HINT_TONES: readonly string[] = ["neutral", "info", "success", "warning", "danger"];
const FIELD_VISIBILITIES: readonly string[] = ["shown", "detail", "hidden"];

/**
 * hintWord reads one declared word, or says nothing.
 *
 * A hint of the wrong kind is correctable, not fatal: the value falls back to
 * the default the reader would have used had the key never been printed, and the
 * defect names itself once. The rest of the same hint object survives it — half a
 * bag of reading decisions is still a bag, and losing a good `singular` because a
 * sibling `icon` was a number is the worse screen. An empty string is silence, not
 * a defect: the reference server prints no key for a zero value, so `""` cannot
 * arrive from a kernel and is not worth a log line.
 */
function hintWord(
  hint: Record<string, unknown>,
  member: string,
  at: string,
  what: string,
  notice: HintNotice,
): string | undefined {
  const value = hint[member];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    notice(`${at}.${member}`, `is not ${what}: the default is used`);
    return undefined;
  }
  return value === "" ? undefined : value;
}

/**
 * hintNames reads one declared list of names. An empty list is silence, and each
 * name keeps the place it was served in: the line that says a name is none of this
 * entry's fields quotes the document, not the list left after rubbish was filtered
 * out of the front of it.
 */
function hintNames(
  hint: Record<string, unknown>,
  member: string,
  at: string,
  notice: HintNotice,
): readonly { readonly name: string; readonly served: number }[] | undefined {
  const value = hint[member];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    notice(`${at}.${member}`, "is not a list of field names: the default is used");
    return undefined;
  }
  const named = value.flatMap((n, i): { readonly name: string; readonly served: number }[] =>
    typeof n === "string" && n !== "" ? [{ name: n, served: i }] : [],
  );
  if (named.length < value.length)
    notice(`${at}.${member}`, "names something the schema does not hold: the rest is used");
  return named.length === 0 ? undefined : named;
}

/**
 * hintEntry reads what an entry says about how it should read.
 *
 * `named` is this entry's own field names: a pointer into the schema is resolved
 * here, where the schema is in hand, so a hint that names no field of this entry
 * is a fallback rather than a blank screen. `sections` is what `readSections`
 * kept of the blocks the entry declares, judged before the fields that name them.
 */
function hintEntry(
  raw: unknown,
  at: string,
  named: readonly string[],
  sections: readonly Section[],
  notice: HintNotice,
): EntryHints | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isRecord(raw)) {
    notice(at, "is not a hint object: no hints are read");
    return undefined;
  }
  const pointer = (member: string): string | undefined => {
    const word = hintWord(raw, member, at, "a field name", notice);
    if (word === undefined) return undefined;
    if (!named.includes(word)) {
      notice(`${at}.${member}`, `names no field of this entry: the default is used`);
      return undefined;
    }
    return word;
  };
  // Each name is checked against this entry's own fields where the list was read,
  // so a pointer at a field that does not exist costs one cell and says so, rather
  // than blanking the row or drawing a column the schema has never heard of. A
  // list left with nothing in it is the default answer, not an empty row.
  const summary = ((): readonly string[] | undefined => {
    const declared = hintNames(raw, "summaryFields", at, notice);
    if (declared === undefined) return undefined;
    const kept: string[] = [];
    for (const { name, served } of declared) {
      if (named.includes(name)) kept.push(name);
      else
        notice(`${at}.summaryFields[${served}]`, "names no field of this entry: it is not drawn");
    }
    return kept.length === 0 ? undefined : kept;
  })();
  const singular = hintWord(raw, "singular", at, "a word", notice);
  const plural = hintWord(raw, "plural", at, "a word", notice);
  const icon = hintWord(raw, "icon", at, "a word", notice);
  const primaryField = pointer("primaryField");
  const previewField = pointer("previewField");
  const statusField = pointer("statusField");
  // The same question `summaryFields` asks: a name that matches no field of this
  // entry costs one sort row and says so, and a list left with nothing in it is
  // the default answer rather than "this list orders by nothing".
  const sortable = ((): readonly string[] | undefined => {
    const declared = hintNames(raw, "sortable", at, notice);
    if (declared === undefined) return undefined;
    const kept: string[] = [];
    for (const { name, served } of declared) {
      if (named.includes(name)) kept.push(name);
      else
        notice(
          `${at}.sortable[${served}]`,
          "names no field of this entry: it is not offered as a sort",
        );
    }
    return kept.length === 0 ? undefined : kept;
  })();
  const hints: EntryHints = {
    ...(singular === undefined ? {} : { singular }),
    ...(plural === undefined ? {} : { plural }),
    ...(icon === undefined ? {} : { icon }),
    ...(primaryField === undefined ? {} : { primaryField }),
    ...(previewField === undefined ? {} : { previewField }),
    ...(statusField === undefined ? {} : { statusField }),
    ...(sortable === undefined ? {} : { sortable }),
    ...(summary === undefined ? {} : { summaryFields: summary }),
    ...(sections.length === 0 ? {} : { sections }),
  };
  return Object.keys(hints).length === 0 ? undefined : hints;
}

/**
 * hintField reads what one field says about how it is drawn.
 *
 * `values` is the field's own enum: a label or tone keyed on a value the enum
 * does not hold is dropped on its own, the sibling keys surviving. `blocks` are the
 * keys of the blocks the owning entry itself kept — a field cannot invent a block no
 * author declared, and cannot name one the entry lost on the way, because the record
 * would then hold a heading nobody named.
 */
function hintField(
  raw: unknown,
  at: string,
  values: readonly string[],
  blocks: readonly string[],
  notice: HintNotice,
): FieldHints | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isRecord(raw)) {
    notice(at, "is not a hint object: no hints are read");
    return undefined;
  }
  const label = hintWord(raw, "label", at, "a word", notice);
  const help = hintWord(raw, "help", at, "a sentence", notice);
  const vocabulary = (
    member: string,
    allowed: readonly string[],
    fallback: string,
  ): string | undefined => {
    const word = hintWord(raw, member, at, `one of ${allowed.join(", ")}`, notice);
    if (word === undefined) return undefined;
    if (!allowed.includes(word)) {
      notice(`${at}.${member}`, `is not a name this build draws: ${fallback}`);
      return undefined;
    }
    return word;
  };
  const visibility = vocabulary("visibility", FIELD_VISIBILITIES, "the field is shown");
  const declaredSection = hintWord(raw, "section", at, "a block name", notice);
  if (declaredSection !== undefined && !blocks.includes(declaredSection))
    notice(`${at}.section`, "names no declared block: the field stays in the overview");
  const keyed = <T>(
    member: string,
    read: (value: unknown) => T | undefined,
    missing: string,
  ): Record<string, T> | undefined => {
    const value = raw[member];
    if (value === undefined) return undefined;
    if (!isRecord(value)) {
      notice(`${at}.${member}`, `is not a list of ${missing}: the default is used`);
      return undefined;
    }
    const kept: Record<string, T> = {};
    for (const [value_, held] of Object.entries(value)) {
      if (!values.includes(value_)) {
        notice(`${at}.${member}.${value_}`, "names no value of this field: it is not drawn");
        continue;
      }
      const read_ = read(held);
      if (read_ === undefined)
        notice(`${at}.${member}.${value_}`, `is not ${missing}: the default is used`);
      else kept[value_] = read_;
    }
    return Object.keys(kept).length === 0 ? undefined : kept;
  };
  const enumLabels = keyed(
    "enumLabels",
    (v) => (typeof v === "string" && v !== "" ? v : undefined),
    "words",
  );
  const enumTones = keyed(
    "enumTones",
    (v) => (typeof v === "string" && HINT_TONES.includes(v) ? (v as HintTone) : undefined),
    "tones",
  );
  const hints: FieldHints = {
    ...(label === undefined ? {} : { label }),
    ...(help === undefined ? {} : { help }),
    ...(declaredSection === undefined || !blocks.includes(declaredSection)
      ? {}
      : { section: declaredSection }),
    // A declared `shown` is stored: unlike the other zero values it is not the
    // same reading as silence, because it overrules a `hideList` the author also
    // wrote (`derive.onList`). Absent means "the schema's own tag decides".
    ...(visibility === undefined ? {} : { visibility: visibility as FieldVisibility }),
    ...(enumLabels === undefined ? {} : { enumLabels }),
    ...(enumTones === undefined ? {} : { enumTones }),
  };
  return Object.keys(hints).length === 0 ? undefined : hints;
}

/** hintCommand reads what one command says about the button it asks for. */
function hintCommand(raw: unknown, at: string, notice: HintNotice): CommandHints | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isRecord(raw)) {
    notice(at, "is not a hint object: no hints are read");
    return undefined;
  }
  const label = hintWord(raw, "label", at, "a phrase", notice);
  const system = raw.system;
  if (system !== undefined && typeof system !== "boolean")
    notice(`${at}.system`, "is not yes or no: the command is offered");
  const hints: CommandHints = {
    ...(label === undefined ? {} : { label }),
    ...(system === true ? { system: true as const } : {}),
  };
  return Object.keys(hints).length === 0 ? undefined : hints;
}

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
type ParsedField = z.output<typeof looseField>;

function field(v: ParsedField, at: string, blocks: readonly string[], notice: HintNotice): Field {
  const { type, elem, enum: values, presentation, ...rest } = v;
  const hints = hintField(presentation, `${at}.presentation`, values ?? [], blocks, notice);
  // The one place the reading axis and the writing axis genuinely collide. A
  // hidden field is plumbing and leaves the form; a *required* one is the
  // person's only path to a create the server will accept, and that path is
  // never taken away — so the field stays visible, the kernel is consulted rather
  // than contradicted (it refuses a pointer at a hidden field, never a required
  // field being hidden), and the author hears it once. The copy that could warn
  // the person is the product's.
  if (hints?.visibility === "hidden" && v.required === true)
    notice(`${at}.presentation.visibility`, "names a required field: it stays in the form");
  return {
    ...rest,
    type: fieldType(type, `${at}.type`),
    ...(elem === undefined ? {} : { elem: fieldType(elem, `${at}.elem`) }),
    ...(values == null ? {} : { enum: values }),
    ...(hints === undefined ? {} : { hints }),
  };
}

/** One block of a record, as its entry declares it. */
type Section = NonNullable<EntryHints["sections"]>[number];

/**
 * readSections is the entry's declared blocks, judged once for both readers.
 *
 * A field names its block, so the blocks have to be read — and judged — before the
 * fields are: `sections` is taken whole or not at all, because a block with no key
 * or no label is no block, and a field left pointing at a block the entry lost
 * would group a fact under a heading no author ever declared. Reading them here is
 * what makes "is this block declared?" one answer, given by `hintField` and by the
 * record's own heading list alike. Silence about a bag that is not a bag at all is
 * `hintEntry`'s: it says once that no hint was read.
 */
function readSections(presentation: unknown, at: string, notice: HintNotice): readonly Section[] {
  if (!isRecord(presentation) || presentation.sections === undefined) return [];
  const value = presentation.sections;
  if (!Array.isArray(value)) {
    notice(`${at}.sections`, "is not a list of blocks: the record stays flat");
    return [];
  }
  const blocks: Section[] = [];
  for (const [i, section] of value.entries()) {
    if (
      !isRecord(section) ||
      typeof section.key !== "string" ||
      section.key === "" ||
      typeof section.label !== "string" ||
      section.label === ""
    ) {
      notice(`${at}.sections`, "holds a block with no key and label: the record stays flat");
      return [];
    }
    if (blocks.some((b) => b.key === (section.key as string))) {
      notice(`${at}.sections[${i}]`, "repeats a block: the first declaration is used");
      continue;
    }
    blocks.push({ key: section.key, label: section.label });
  }
  return blocks;
}

function entry(v: ParsedEntry, at: string, notice: HintNotice): Entry {
  const { fields, commands, immutable, operations, renderer, singleton, presentation, ...rest } = v;
  const pack = rendererRef(renderer);
  const blocks = readSections(presentation, `${at}.presentation`, notice);
  const fieldsRead = (fields ?? []).map((f, i) =>
    field(
      f,
      `${at}.fields[${i}]`,
      blocks.map((b) => b.key),
      notice,
    ),
  );
  const hints = hintEntry(
    presentation,
    `${at}.presentation`,
    fieldsRead.map((f) => f.name),
    blocks,
    notice,
  );
  return {
    ...rest,
    path: absolute(v.path, `${at}.path`),
    ...(pack === undefined ? {} : { renderer: pack }),
    ...(v.write_path === undefined
      ? {}
      : { writePath: absolute(v.write_path, `${at}.write_path`) }),
    fields: fieldsRead,
    ...(hints === undefined ? {} : { hints }),
    immutable: immutable ?? [],
    ...(operations == null ? {} : { operations: verbs(operations, `${at}.operations`) }),
    commands: (commands ?? []).map(({ fields, path, presentation: commandHint, ...command }, i) => {
      const hint = hintCommand(commandHint, `${at}.commands[${i}].presentation`, notice);
      return {
        ...command,
        ...(hint === undefined ? {} : { hints: hint }),
        ...(path === undefined ? {} : { path: absolute(path, `${at}.commands[${i}].path`) }),
        fields: (fields ?? []).map((f, n) =>
          field(f, `${at}.commands[${i}].fields[${n}]`, [], notice),
        ),
      };
    }),
    singleton: singleton ?? false,
  };
}

/** parseCatalog is the only way a Catalog is made from bytes. */
export function parseCatalog(input: unknown, notice: HintNotice = () => {}): Catalog {
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
    resources: (resources ?? []).map((r, i) => entry(r, `resources[${i}]`, notice)),
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
