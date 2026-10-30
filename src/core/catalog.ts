// Generated schemas own the wire shape; this module owns the supported kinds,
// catalog version, address semantics and the native normalized view.
import { z } from "zod";
import type {
  Catalog as WireCatalog,
  Entry as WireEntry,
  Field as WireField,
  Command as WireCommand,
  MapKey as WireMapKey,
} from "../generated/types.gen";
import { zCatalog, zCommand, zEntry, zField } from "../generated/zod.gen";
import { drawnIcon, pictureDoor, type Pictures } from "./pictures";
import type { SavedDeclaration } from "./saved";
import { issuePath } from "./responses";
import { readDeck, type Deck } from "./catalogDeck";
import { applyChoices, type FieldChoice } from "./choice";
import { readPolicy, type Policy, type PolicyField } from "./catalogPolicy";
import { FIELD_TYPES } from "./fieldTypes";

export { SUPPORTED_POLICY_VERSION, type Policy, type PolicyField } from "./catalogPolicy";

// Zod retains explicitly undefined optional properties on in-memory inputs.
// Required wire members remain required; JSON itself never contains undefined.
type View<T> = Readonly<
  {
    [K in keyof T as undefined extends T[K] ? K : never]?: T[K] | undefined;
  } & {
    [K in keyof T as undefined extends T[K] ? never : K]: T[K];
  }
>;

export { FIELD_TYPES } from "./fieldTypes";
export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * MapKey is one key of a field whose value is a map: the word the person sees, and
 * the member of the row it is read from when it is not typed in.
 */
export type MapKey = View<WireMapKey>;

// `keys` names its own record, so its view is declared here: View maps one level,
// and a parsed key carries `| undefined` on members the wire type leaves optional.
export type Field = View<Omit<WireField, "type" | "elem" | "enum" | "presentation" | "keys">> & {
  readonly type: FieldType;
  readonly elem?: FieldType;
  readonly enum?: readonly string[];
  readonly keys?: readonly MapKey[] | null;
  readonly hints?: FieldHints;
  /** How the server resolved this field; present exactly when its entry carries `resolved`. */
  readonly policy?: PolicyField;
  /**
   * choice is the field's finite choice as the server resolved it (`./choice`): the surface that
   * draws it, its answers in order, its cardinality, maximum and empty policy. Absent — which is
   * what a server older than the section says about every field — leaves the schema's own reading.
   */
  readonly choice?: FieldChoice;
};

export type Command = View<Omit<WireCommand, "fields" | "presentation" | "output">> & {
  readonly fields: readonly Field[];
  readonly hints?: CommandHints;
  /**
   * bindings says which argument of this command the server fills from which field of the row
   * the command runs on (`kit/rest`'s RowBindings): `{questionId: "questionId"}` means the body
   * member `questionId` carries that row's `questionId`. A server-side renderer draws the button
   * beside the row it binds from; a phone holds the same row, so it fills the same pair — see
   * `boundArguments`. A pair naming a field this entry does not print is dropped as a defect.
   */
  readonly bindings?: Readonly<Record<string, string>>;
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
/**
 * @deprecated Pack identity is declared, not printed: a product declares its pack
 * with `definePack` (`src/pack.ts`), whose key is the `module/entity` the pinned
 * document answers a read of. This shape stays because the kernel owns the `renderer`
 * member and may print it again; nothing a build writes should reach for it.
 */
export interface RendererRef {
  readonly name: string;
  /** minShell is the lowest SHELL_VERSION whose shell can draw this pack's screen. */
  readonly minShell: number;
}

export type Entry = View<
  Omit<
    WireEntry,
    | "fields"
    | "commands"
    | "immutable"
    | "input"
    | "singleton"
    | "operations"
    | "presentation"
    | "resolved"
  >
> & {
  readonly fields: readonly Field[];
  readonly commands: readonly Command[];
  readonly immutable: readonly string[];
  readonly singleton: boolean;
  readonly writePath?: string;
  // The document prints a list of words; this type holds only the verbs
  // CRUD_VERBS names, because verbs() refuses every other word at parse.
  readonly operations?: readonly CrudVerb[];
  // The kernel owns whether an entry names a renderer; it is read as `unknown`
  // so that a malformed name costs a pack and not a screen.
  readonly renderer?: RendererRef;
  readonly hints?: EntryHints;
  /** The server's resolved policy, present only when this build supports the block. */
  readonly resolved?: Policy;
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
  readonly deck?: Deck;
  readonly singular?: string;
  readonly plural?: string;
  readonly icon?: string;
  readonly primaryField?: string;
  readonly previewField?: string;
  readonly summaryFields?: readonly string[];
  readonly statusField?: string;
  readonly coverField?: string;
  readonly thumbnailField?: string;
  /**
   * sortable names the fields a list may be ordered by, in the order its sheet
   * lists them. It is the kernel's own member (`kit/entity`), read here so no
   * component reaches past the parser into the generated wire type; absent means
   * the sheet answers with the field the entry leads rows with plus the date
   * fields it declares (`sortFields`).
   */
  readonly sortable?: readonly string[];
  readonly sections?: readonly { readonly key: string; readonly label: string }[];
  /**
   * highlight is what one sub-count of this entry counts, in the words the catalogue
   * declares. The counts body answers numbers and never a word, so a card may say
   * about a sub-count only what is declared here; its `filter` member is not read,
   * because nothing in this build narrows a list with it. Absent means there is no
   * word for the sub-count, and no sub-count is drawn.
   */
  readonly highlight?: { readonly label: string };
  /**
   * primaryCommand is the verb a row's swipe runs, kept only when it resolves: one of this
   * entry's own commands, offered to a person, about one record and taking no argument. The
   * kernel refuses every other declaration when it mounts the resource, and a phone built
   * against an older kernel refuses it here, so the model can hold no verb it could not run.
   * Absent means no row of this entry swipes.
   */
  readonly primaryCommand?: string;
  /**
   * saved declares this entry a source of saved copies — the words a heart prints, the word
   * that names the removal when it is refused, and the entry that holds the person's copies
   * of it. Every member is required, so a declaration missing one is dropped whole rather
   * than drawn half a control, and each missing member says which it is; `core/saved.ts`
   * reads `listEntry` against the mounted catalogue and answers whether a heart is drawable.
   * The kernel's `listTitle` is no member of this kit: it names a page the composition owns,
   * which this phone already names from that entry's own words.
   */
  readonly saved?: SavedDeclaration;
  /**
   * availabilityField names the field of this entry whose value says whether the source of
   * a copy is still there — "available", "unavailable" or "temporary", spelled by
   * `core/saved.ts` alone. A pointer at a field this entry does not print costs the
   * shading: an unshaded list is a correct list that cannot yet grey a row.
   */
  readonly availabilityField?: string;
}

export interface FieldHints {
  readonly label?: string;
  readonly help?: string;
  /** section names a key of the owning entry's declared sections. */
  readonly section?: string;
  readonly visibility?: FieldVisibility;
  readonly enumLabels?: Readonly<Record<string, string>>;
  readonly enumTones?: Readonly<Record<string, HintTone>>;
  /**
   * doneValues are the values of this field's enum that mean *finished* — the subset a shell may
   * celebrate (`kit/entity/hints.go`). It is orthogonal to `enumTones`: which values are finished
   * is the entity's fact, which colour finished wears is a drawing decision, so neither answers
   * the other. The author declares it on the entry's `statusField` alone and the mount gate
   * refuses it anywhere else. Absent, or a list holding none of this field's values, is stored as
   * silence: nothing is finished and nothing celebrates.
   */
  readonly doneValues?: readonly string[];
  /**
   * reference names the resource this field's value points at, spelled the way
   * the document spells it (`"user/user"`). It is what lets a value read as the
   * record it points at rather than as the identifier stored for it; a pointer
   * with no declared target — a picker widget alone — keeps the same reading of
   * its value and only loses which resource a name could come from.
   */
  readonly reference?: { readonly resource: string };
}

export interface CommandHints {
  readonly label?: string;
  /** system is stored only when declared true: the kernel prints no key for a
   * false one, so silence and false are one reading and need no member. */
  readonly system?: true;
  /**
   * confirmation is what running the command does, said above the answer. Only
   * the body is read: the title of the question is the command's own label
   * (`derive.commandTitle`) and the answer is the same word, so a sheet never
   * asks a person to read a second name for the thing they just chose.
   */
  readonly confirmation?: { readonly body: string };
  /** successMessage is the sentence the record says after the command ran. */
  readonly successMessage?: string;
  /**
   * destructive is stored only when declared true, like `system`. Where a wrong reading of
   * `system` hides a button, a wrong reading of this one burns a record, so a declared value
   * that is not yes or no is read as destructive and said: the question stays, the write does
   * not run on a guess.
   */
  readonly destructive?: true;
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
export const SUPPORTED_CATALOG_VERSION = 3;

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
/**
 * @deprecated A declared pack needs no shell handshake: its key is checked against
 * the pinned document at compile time, so there is no version of this phone for it to
 * be ahead of. This number is what an entry that prints `renderer.min_shell` is still
 * measured against, and it goes when the kernel stops printing that member.
 */
export const SHELL_VERSION = 1;

export type Catalog = View<Omit<WireCatalog, "catalogVersion" | "resources" | "pictures">> & {
  readonly pictures?: Pictures;
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
// `choices` is the schema's own guess at a field's answers, and this build answers a finite
// choice from the server's resolved block (`./choice`), never from the declaration, so the hint
// is not carried — the way a command's `output` is not. It is also what the read cannot hold:
// `View` maps one level, and a parsed choice set carries `| undefined` on the members the wire
// type leaves optional. A wrong choice declaration is therefore not read at all rather than
// refused; the resolved answer set beside it is judged, and that is the one a person draws from.
const declaredField = zField.omit({ choices: true });
const looseField = declaredField.extend({ presentation: z.unknown().optional() });
const looseCommand = zCommand.extend({
  fields: z.array(looseField).nullish(),
  presentation: z.unknown().optional(),
  // `bindings` is a kernel member this build's document does not print yet, so it enters as
  // `unknown` and commandBindings below decides its shape: a mistyped binding may cost the one
  // argument it names, never the entry, the same way `renderer` and `presentation` are read.
  bindings: z.unknown().optional(),
  // The phone reads no command result, so the declaration is not carried.
  output: z.unknown().optional(),
});

const catalogSchema = zCatalog.extend({
  pictures: z.unknown().optional(),
  resources: z
    .array(
      zEntry.extend({
        operations: z.array(z.string()).nullish(),
        renderer: z.unknown().optional(),
        presentation: z.unknown().optional(),
        // `resolved` is the server's own reading of the entry, decided at mount time. It enters as
        // `unknown` for the reason `presentation` does: it is presentation, so a member this build
        // cannot read costs that member and not the screen.
        resolved: z.unknown().optional(),
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
 * `commands` are the entry's own commands, already read: the verb a row swipes to
 * run is resolved against them here, where both are in hand, so no surface ever
 * holds a command this entry does not have.
 */
function hintEntry(
  raw: unknown,
  at: string,
  fields: readonly Field[],
  sections: readonly Section[],
  commands: readonly Command[],
  notice: HintNotice,
): EntryHints | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isRecord(raw)) {
    notice(at, "is not a hint object: no hints are read");
    return undefined;
  }
  const named = fields.map((f) => f.name);
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
  const declaredIcon = hintWord(raw, "icon", at, "a word", notice);
  const icon = drawnIcon(declaredIcon);
  if (declaredIcon && !icon) notice(`${at}.icon`, "is not a supported icon: the default is used");
  const picturePointer = (member: string, row: boolean): string | undefined => {
    const name = pointer(member);
    if (!name) return undefined;
    const field = fields.find((f) => f.name === name)!;
    const visible =
      field.hints?.visibility !== "hidden" &&
      (!row ||
        (field.hints?.visibility !== "detail" &&
          (field.hints?.visibility !== undefined || !field.hideList)));
    if (
      field.present !== "image" ||
      !["string", "uuid", "picture"].includes(field.type) ||
      !visible
    ) {
      notice(`${at}.${member}`, "does not name a visible scalar picture: the default is used");
      return undefined;
    }
    return name;
  };
  const coverField = picturePointer("coverField", false);
  const thumbnailField = picturePointer("thumbnailField", true);
  const primaryField = pointer("primaryField");
  const previewField = pointer("previewField");
  const statusField = pointer("statusField");
  // The verb a row swipes to run is asked the four questions the kernel asks of it when it
  // mounts the resource (kit/rest's own row-hint gate): is it a command of this entry, is it
  // offered to a person, does it run on one record, does it send no argument. The phone asks
  // them anyway because a build in somebody's pocket may meet an older server, and a row that
  // offered a command it cannot resolve would ask a question no door answers. Each refusal
  // costs the swipe and nothing else: the entry keeps its rows, its commands and every other
  // hint it declared.
  const primaryCommand = ((): string | undefined => {
    const verb = hintWord(raw, "primaryCommand", at, "a command of this entry", notice);
    if (verb === undefined) return undefined;
    const named = commands.find((c) => c.verb === verb);
    if (named === undefined) {
      notice(`${at}.primaryCommand`, "names no command of this entry: the row offers no swipe");
      return undefined;
    }
    if (named.hints?.system === true) {
      notice(
        `${at}.primaryCommand`,
        "is a system command; no person is offered it: the row offers no swipe",
      );
      return undefined;
    }
    if (named.collection === true) {
      notice(`${at}.primaryCommand`, "runs on the collection: the row offers no swipe");
      return undefined;
    }
    if (named.fields.length > 0) {
      notice(
        `${at}.primaryCommand`,
        "takes arguments; a row's swipe sends none: the row offers no swipe",
      );
      return undefined;
    }
    return verb;
  })();
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
  // A sub-count is only sayable in the catalogue's own words, so a highlight that is
  // not an object, or names nobody, costs the sub-count and says which: the entry's
  // other readings survive their author's typo, as every other hint's do.
  const highlight = ((): { readonly label: string } | undefined => {
    const declared = raw.highlight;
    if (declared === undefined || declared === null) return undefined;
    if (!isRecord(declared)) {
      notice(`${at}.highlight`, "is not a hint object: the sub-count is not drawn");
      return undefined;
    }
    const label = hintWord(declared, "label", `${at}.highlight`, "a word", notice);
    return label === undefined ? undefined : { label };
  })();
  // A saved declaration is the four members a keeping control cannot do without, or nothing:
  // the two words the heart prints, the word that names the removal when it is refused, and
  // the entry the copy lives on, so a half-declaration could only draw a control that leads
  // nowhere. Every member that is missing, blank or not a word says for itself: an author
  // reading a refused heart has to be told which word their document left out. The kernel's
  // fifth word (`listTitle`) is not read here — see `SavedDeclaration`.
  const saved = ((): SavedDeclaration | undefined => {
    if (raw.saved === undefined || raw.saved === null) return undefined;
    if (!isRecord(raw.saved)) {
      notice(`${at}.saved`, "is not a hint object: nothing is savable");
      return undefined;
    }
    const declared = raw.saved;
    const atSaved = `${at}.saved`;
    const word = (member: string, what: string): string | undefined => {
      const value = declared[member];
      if (value === undefined) {
        notice(`${atSaved}.${member}`, `declares no ${what}: nothing is savable`);
        return undefined;
      }
      if (typeof value !== "string" || value.trim() === "") {
        notice(`${atSaved}.${member}`, `is not ${what}: nothing is savable`);
        return undefined;
      }
      return value;
    };
    // Asked for one at a time, so a document missing two of them says both.
    const keep = word("save", "word to keep a copy with");
    const kept = word("saved", "word to name a copy kept");
    const away = word("remove", "word to name the copy taken away");
    const listEntry = word("listEntry", '"module/entity" of the entry holding the copies');
    return keep === undefined || kept === undefined || away === undefined || listEntry === undefined
      ? undefined
      : { save: keep, saved: kept, remove: away, listEntry };
  })();
  const hints: EntryHints = {
    ...(() => {
      const deck = readDeck(raw.deck, fields, sortable, commands, HINT_TONES, `${at}.deck`, notice);
      return deck === undefined ? {} : { deck };
    })(),
    ...(singular === undefined ? {} : { singular }),
    ...(plural === undefined ? {} : { plural }),
    ...(icon === undefined ? {} : { icon }),
    ...(coverField === undefined ? {} : { coverField }),
    ...(thumbnailField === undefined ? {} : { thumbnailField }),
    ...(primaryField === undefined ? {} : { primaryField }),
    ...(previewField === undefined ? {} : { previewField }),
    ...(statusField === undefined ? {} : { statusField }),
    ...(sortable === undefined ? {} : { sortable }),
    ...(summary === undefined ? {} : { summaryFields: summary }),
    ...(highlight === undefined ? {} : { highlight }),
    ...(sections.length === 0 ? {} : { sections }),
    ...(primaryCommand === undefined ? {} : { primaryCommand }),
    ...(saved === undefined ? {} : { saved }),
    ...(() => {
      const field = pointer("availabilityField");
      return field === undefined ? {} : { availabilityField: field };
    })(),
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
  // A done value is read the way an enum label is: one bad entry is named and dropped on its own,
  // so an author's mistake costs the celebration and never the field. A value the enum does not
  // hold is refused here rather than remembered, because the phone compares it against rows and
  // a value no row can hold would ask a question nothing answers.
  const doneValues = ((): readonly string[] | undefined => {
    const value = raw.doneValues;
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
      notice(`${at}.doneValues`, `is not a list of this field's values: nothing is finished`);
      return undefined;
    }
    const kept: string[] = [];
    for (const held of value) {
      if (typeof held !== "string" || !values.includes(held)) {
        const name = typeof held === "string" ? `"${held}"` : String(held);
        notice(
          `${at}.doneValues`,
          `names ${name}, which is no value of this field: it is not finished`,
        );
        continue;
      }
      if (!kept.includes(held)) kept.push(held);
    }
    if (kept.length === 0) {
      // An empty list is the one absence no entry named, so it names itself.
      if (value.length === 0) notice(`${at}.doneValues`, "names no value: nothing is finished");
      return undefined;
    }
    return kept;
  })();
  // A pointer is read as an object with one word in it, and a wrong one costs the
  // reading of the value and nothing else: the field keeps its label, its section
  // and its visibility, and the value is shown the way a document with no hint
  // shows it.
  const reference = ((): { readonly resource: string } | undefined => {
    const value = raw.reference;
    if (value === undefined) return undefined;
    if (!isRecord(value) || typeof value.resource !== "string" || value.resource === "") {
      notice(`${at}.reference`, "names no resource: the value is read as stored");
      return undefined;
    }
    return { resource: value.resource };
  })();
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
    ...(doneValues === undefined ? {} : { doneValues }),
    ...(reference === undefined ? {} : { reference }),
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
  const successMessage = hintWord(raw, "successMessage", at, "a sentence", notice);
  const system = raw.system;
  if (system !== undefined && typeof system !== "boolean")
    notice(`${at}.system`, "is not yes or no: the command is offered");
  // Read as destructively as it is refused: a value that is neither yes nor no is asked about
  // before it runs, which is the one way a malformed declaration cannot cost a record.
  const destructive = raw.destructive;
  if (destructive !== undefined && typeof destructive !== "boolean")
    notice(`${at}.destructive`, "is not yes or no: the command is asked before it runs");
  // The consequence is one word in an object. A confirmation that is not an
  // object, or holds no readable body, costs the sentence under the question and
  // says so; the command keeps its label, its `system` tag and its success line.
  const confirmation = ((): { readonly body: string } | undefined => {
    const value = raw.confirmation;
    if (value === undefined) return undefined;
    if (!isRecord(value)) {
      notice(`${at}.confirmation`, "is not a hint object: the consequence is not read");
      return undefined;
    }
    if (typeof value.body !== "string" || value.body === "") {
      notice(`${at}.confirmation.body`, "is not words: the consequence is not read");
      return undefined;
    }
    return { body: value.body };
  })();
  const hints: CommandHints = {
    ...(label === undefined ? {} : { label }),
    ...(system === true ? { system: true as const } : {}),
    ...(destructive === true || (destructive !== undefined && typeof destructive !== "boolean")
      ? { destructive: true as const }
      : {}),
    ...(confirmation === undefined ? {} : { confirmation }),
    ...(successMessage === undefined ? {} : { successMessage }),
  };
  return Object.keys(hints).length === 0 ? undefined : hints;
}

/**
 * commandBindings keeps the argument-to-field pairs of one command that name a field of this
 * entry. A pair naming anything else could only ever be filled with a guess, so it is dropped
 * and names itself once; the command keeps every other argument it declared.
 */
function commandBindings(
  raw: unknown,
  fields: readonly { readonly name: string }[],
  at: string,
  notice: HintNotice,
): Readonly<Record<string, string>> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isRecord(raw)) {
    notice(at, "is not an object: no argument of this command is filled from the row");
    return undefined;
  }
  const kept: Record<string, string> = {};
  for (const [argument, field] of Object.entries(raw)) {
    if (typeof field !== "string" || !fields.some((f) => f.name === field)) {
      notice(`${at}.${argument}`, "names no field of this entry: it is not filled from the row");
      continue;
    }
    kept[argument] = field;
  }
  return Object.keys(kept).length === 0 ? undefined : kept;
}

/**
 * rendererRef reads which pack an entry asks for, or says that it asks for none. It
 * reads a wire member the kernel owns and prints nothing of today, which is why a
 * malformed one costs the entry nothing.
 */
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
  const { type, elem, enum: values, keys, presentation, ...rest } = v;
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
  if (type === "picture" && v.readOnly !== true)
    notice(`${at}.readOnly`, "is a derived picture: writable input is ignored");
  if (elem === "picture")
    throw new CatalogError(`${at}.elem`, "lists of pictures are not supported");
  return {
    ...rest,
    ...(type === "picture" ? { readOnly: true } : {}),
    type: fieldType(type, `${at}.type`),
    ...(elem === undefined ? {} : { elem: fieldType(elem, `${at}.elem`) }),
    ...(keys === undefined ? {} : { keys }),
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
  const {
    fields,
    commands,
    immutable,
    operations,
    renderer,
    singleton,
    presentation,
    resolved,
    // `input` is the typed-read block: the fields a caller of a read must name. No screen in this
    // build opens a typed read, so the declaration is validated by the contract's own schema and
    // carried by no type here — the way a command's `output` is validated and not carried.
    input: _typedRead,
    ...rest
  } = v;
  const pack = rendererRef(renderer);
  const blocks = readSections(presentation, `${at}.presentation`, notice),
    blockKeys = blocks.map((b) => b.key);
  // The commands are read before the entry's own hints because one of those hints names one of
  // them: a verb no command of this entry answers is no hint at all, and the resolution happens
  // here, once, rather than at every surface that offers the verb.
  const commandsRead = (commands ?? []).map(
    (
      {
        fields: arguments_,
        path,
        presentation: commandHint,
        bindings,
        output: _output,
        ...command
      },
      i,
    ) => {
      const hint = hintCommand(commandHint, `${at}.commands[${i}].presentation`, notice);
      const bound = commandBindings(
        bindings,
        fields ?? [],
        `${at}.commands[${i}].bindings`,
        notice,
      );
      return {
        ...command,
        ...(hint === undefined ? {} : { hints: hint }),
        ...(bound === undefined ? {} : { bindings: bound }),
        ...(path === undefined ? {} : { path: absolute(path, `${at}.commands[${i}].path`) }),
        fields: (arguments_ ?? []).map((f, n) =>
          field(f, `${at}.commands[${i}].fields[${n}]`, [], notice),
        ),
      };
    },
  );
  const policy = readPolicy(
    resolved,
    `${at}.resolved`,
    (fields ?? []).map((f) => f.name),
    notice,
  );
  const described = policy?.fields ?? [];
  const fieldsRead = applyChoices(
    (fields ?? []).map((f, i) => field(f, `${at}.fields[${i}]`, blockKeys, notice)),
    resolved,
    `${at}.resolved`,
    notice,
  ).map((read) => {
    const answer = described.find((p) => p.name === read.name);
    return answer === undefined ? read : { ...read, policy: answer };
  });
  const hints = hintEntry(
    presentation,
    `${at}.presentation`,
    fieldsRead,
    blocks,
    commandsRead,
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
    ...(policy === undefined ? {} : { resolved: policy }),
    ...(hints === undefined ? {} : { hints }),
    immutable: immutable ?? [],
    // A nil operation set prints as null and is the absent set: kit/rest reads
    // a nil slice and an empty one as all five, and so does `offers`.
    ...(operations == null ? {} : { operations: verbs(operations, `${at}.operations`) }),
    commands: commandsRead,
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
  const { resources, pictures: rawPictures, catalogVersion: _stamp, ...metadata } = result.data;
  const pictures = pictureDoor(rawPictures, notice);
  return {
    ...metadata,
    ...(pictures ? { pictures } : {}),
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
 *
 * @deprecated The name half is the kernel's dormant `renderer.name`, which a declared
 * pack does not need: `key(e)` alone is what `definePack` registers under, and the two
 * agree whenever the server prints nothing. A pack no entry names by key is reachable
 * only through a plain `Renderers` record for the rest of this window.
 */
export const packKey = (e: Entry): string => e.renderer?.name ?? key(e);

/**
 * shellReady says whether this build can draw the pack the entry names. An entry
 * that names no pack needs nothing; one that needs a newer shell is drawn by the
 * generated screens, which is a fallback, not a refusal.
 *
 * @deprecated Replaced by the compile-time check `definePack` makes; kept because an
 * entry that prints `renderer.min_shell` is still drawn generated until the app is.
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
