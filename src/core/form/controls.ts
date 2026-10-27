/** controls: the editor each field gets, in the order a person types them. */
import { Entry, Field } from "../catalog";
import { policyForm } from "../derivePolicy";
import { control } from "../internals";
import { type Pointer, type Row, primary, recordSections } from "../record";
import { type Names, label, nameKey, pointedAt, points, text } from "../present";

/**
 * controlPointers are the records the greyed boxes of a sheet point at: each is
 * drawn as a name, so each is asked once. A box a person types into is not here —
 * it holds the identifier it must send and asks about nothing. The identifier is
 * read from the row and never from the control, whose own string is what the box
 * draws and may already be somebody's name.
 */
export function controlPointers(
  controls: readonly Control[],
  row: Row | undefined,
): readonly Pointer[] {
  const seen = new Set<string>();
  const out: Pointer[] = [];
  for (const c of controls) {
    const resource = c.readOnly && points(c.field) ? pointedAt(c.field) : undefined;
    const id = resource === undefined || row === undefined ? "" : text(row[c.field.name]);
    if (resource === undefined || id === "" || seen.has(nameKey(resource, id))) continue;
    seen.add(nameKey(resource, id));
    out.push({ resource, id });
  }
  return out;
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
  /**
   * echo is the row's own value for a field this form lets nobody type: a field
   * the author hid, or one the catalogue freezes. `writeControls` is the only
   * writer, and `values` is the only reader — it sends this back byte for byte
   * instead of coercing `value`, because a value that never entered an editor
   * should not be reshaped by one. Absent means the person can answer the field,
   * so its text is what they typed or what the row handed the box.
   */
  readonly echo?: unknown;
  /**
   * rich says the author declared this field's value a rich text body, so the sheet offers
   * the formatting controls over the box — the marks this phone's reader draws back, and
   * the picture the body may point at. Absent means the box is only a box.
   */
  readonly rich?: boolean;
}

/** kind is the control a field gets: the tag when the entity named one, the type otherwise. */
export function kind(f: Field): ControlKind {
  if ((f.enum && f.enum.length > 0) || f.widget === "select") return "select";
  if (f.widget === "textarea") return "textarea";
  // Until T-0192 brings 0069 §7's editor, a rich text body is at least written as prose: the owner met a one-line
  // box writing content (2026-10-09). The server still validates the Markdown either way.
  if (f.widget === "richtext") return "textarea";
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

/**
 * formControls: one control per writable field; immutable fields are read-only on edit and absent on create.
 *
 * `names` is what this screen resolved of the records its greyed boxes point at.
 * A box nobody can type into draws that name and keeps the row's own value in
 * `echo` (added by `writeControls`), so the person reads "Assignee — Ada Lovelace"
 * and the write sends the identifier it was given. A box a person types into keeps
 * the identifier: there is no picker yet, and the value in the box is the value
 * that will be sent.
 */
export function formControls(
  e: Entry,
  row: Row | undefined,
  create: boolean,
  names?: Names,
): readonly Control[] {
  const out: Control[] = [];
  for (const f of policyForm(e, create) ?? e.fields) {
    if (f.readOnly || f.type === "picture") continue;
    // A field the author hid is plumbing: it stays in the schema, the JSON and
    // the PATCH, but not in the sheet. A *required* field is the exception —
    // taking the person's only path to a submittable create away is the write
    // this build never makes, and one ugly row is the lesser screen. The parser
    // already named the pair once.
    if (f.hints?.visibility === "hidden" && f.required !== true) continue;
    const immutable = e.immutable.includes(f.name);
    if (create && immutable) continue;
    const stored = row && f.name in row ? text(row[f.name]) : create ? (f.default ?? "") : "";
    const value =
      immutable && points(f) && names !== undefined
        ? (names[nameKey(pointedAt(f) ?? "", stored)] ?? stored)
        : stored;
    out.push(control(f, value, immutable));
  }
  return out;
}

/**
 * writeControls is the body of a whole-row replace: every field this client may write,
 * which is the sheet's own controls plus the writable ones the sheet was not shown - a
 * hidden one the author keeps as plumbing, an immutable one the row returned - each
 * carrying the value the read gave back. A PUT replaces the whole row, so a field left
 * out of the body is a field cleared by omission. Fields the catalogue itself marks
 * read-only (`id`, `createdAt`, `updatedAt`) are the server's own and never join, and a
 * field neither the read returned nor the sheet asks is not invented.
 *
 * What the person cannot type goes back as an `echo`: the row's own value, unparsed.
 * The string a control holds is an editor's spelling — a list is its items joined by
 * `", "`, a blank is an empty box — and reading a row through it and back out loses
 * whatever the spelling cannot carry: `"North, West"` as one item becomes two, `" North "`
 * and `""` lose their padding and themselves. Only what somebody typed has earned the
 * right to be re-spelled.
 */
export function writeControls(
  e: Entry,
  row: Row | undefined,
  drawn: readonly Control[],
): readonly Control[] {
  // An immutable field is drawn greyed: no keystroke can name it, so the read's own
  // value is what travels, and the control stays greyed for whoever draws it.
  const out = drawn
    .filter((c) => c.field.type !== "picture")
    .map((c) =>
      c.readOnly && row !== undefined && c.field.name in row
        ? { ...c, echo: row[c.field.name] }
        : c,
    );
  const named = new Set(out.map((c) => c.field.name));
  for (const f of e.fields) {
    if (f.readOnly || f.type === "picture" || named.has(f.name)) continue;
    if (row === undefined || !(f.name in row)) continue;
    // `value` stays the editor's spelling for the one answer the row cannot give —
    // a JSON `null` echoes nothing, and the box's own blank is what is left to send.
    out.push({ ...control(f, text(row[f.name]), false), echo: row[f.name] });
    named.add(f.name);
  }
  return out;
}

/**
 * FormBlock is one group of a form: the declared key (or "" for the group that
 * names none), the label drawn above it ("" draws no heading), and the controls
 * in the order a person meets them.
 */
export interface FormBlock {
  readonly key: string;
  readonly label: string;
  readonly controls: readonly Control[];
}

/**
 * orderControls is the order inside a block: the field the record is called by,
 * then the required fields, then the optional ones, schema order within each.
 *
 * `identity` is the entry's own `primary` field name, and it is passed only for
 * the block that holds that field: a declaration says where a fact goes, so the
 * sheet leads a block with the name of the record but never lifts a field out of
 * the block its entry filed it in. Where an author filed the name of the record
 * in a later block, that block leads with it — and the answer to "ask for the
 * name first" is the catalogue's `sections`, not an override written here.
 */
export function orderControls(controls: readonly Control[], identity?: string): readonly Control[] {
  const rank = (c: Control) => (c.field.name === identity ? 0 : c.required ? 1 : 2);
  return controls
    .map((control, at) => ({ control, at }))
    .sort((a, b) => rank(a.control) - rank(b.control) || a.at - b.at)
    .map(({ control }) => control);
}

/**
 * formSections is the sheet as data — `recordSections`' shape for a form: the
 * fields `formControls` offers, grouped as the entry declares its sections, in
 * the order the entry declared them, each block holding its fields in the order
 * `orderControls` gives them.
 *
 * A declared block that holds no control draws nothing: an empty heading over an
 * empty card is the fault 0085 photographs. A field the entry filed nowhere lands
 * in the final block, which is named with the `overview` word the caller passes —
 * the same word the record calls that block — and an entry that declares no
 * sections at all gets exactly one block that names none, because the sheet *is*
 * the form and 0085 asks no heading on it. Which fields exist, what they hold and
 * whether they are editable stays entirely `formControls`' answer: this groups and
 * orders, and adds or removes nothing.
 */
export function formSections(
  e: Entry,
  row: Row | undefined,
  create: boolean,
  overview: string,
  names?: Names,
): readonly FormBlock[] {
  const controls = formControls(e, row, create, names);
  const identity = primary(e)?.name;
  // Under a supported block the order inside a block is the server's: `layout.create`
  // and `layout.update` already name the fields in the order they ask for them, and
  // ranking them again here would draw an order neither client agreed on.
  const order = (own: readonly Control[]): readonly Control[] =>
    e.resolved === undefined ? orderControls(own, identity) : own;
  const filed = (c: Control) => c.field.hints?.section;
  const declared = e.hints?.sections ?? [];
  const blocks: FormBlock[] = declared.flatMap((section) => {
    const own = controls.filter((c) => filed(c) === section.key);
    return own.length === 0
      ? []
      : [{ key: section.key, label: section.label, controls: order(own) }];
  });
  const rest = controls.filter((c) => !declared.some((s) => s.key === filed(c)));
  return rest.length === 0
    ? blocks
    : [
        ...blocks,
        {
          key: "",
          label: declared.length === 0 ? "" : overview,
          controls: order(rest),
        },
      ];
}
