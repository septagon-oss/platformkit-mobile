/** problems: what a person has to fix before the phone can send the form. */
import { control, listValues, sameAnswer } from "../internals";
import { numberValue, timeValue, timeWire, valueHoldsSeparator, values } from "./values";
import { type Control, kind } from "./controls";
import { label, text } from "../present";

/**
 * FormWords is the copy a form needs to refuse what it can refuse: the sentences
 * arrive from the phone's own bundle, because `derive` never asks which language
 * a person reads and a sentence written here would be a second implementation of
 * the copy table.
 */
export interface FormWords {
  /** A value whose storage is comma-joined cannot hold the separator in one item. */
  readonly commaInValue: string;
  /** A field the person owes a value for, left empty: for the boxes one types into. */
  readonly fieldRequired: (field: string) => string;
  /** The same refusal for a field whose value is chosen rather than typed. */
  readonly fieldChoiceRequired: (field: string) => string;
  /** A box that takes a number, holding something that is not one. */
  readonly fieldNumber: string;
  /** A box that takes an instant, holding something that is not one. */
  readonly fieldTime: string;
}

/**
 * problems is what a form can refuse before the server does: a required field left
 * empty, a number that is not one, an instant that is not one, a comma-joined value
 * that does not spell its own items. Everything else - ranges, units, uniqueness,
 * permission - is the server's, answered in the same shape, so a form shows both the
 * same way. Each answer is a sentence naming what to mend, and the sheet runs this on
 * submit, which is what lets it ask for the first field that needs mending.
 */
export function problems(
  controls: readonly Control[],
  held: Readonly<Record<string, string>>,
  words: FormWords,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const c of controls) {
    if (c.readOnly) continue;
    const raw = held[c.field.name] ?? c.value;
    if (raw === "") {
      // An empty field is a refusal only where the person owes one - and never for a
      // switch, which answers for itself (values reads "" as off), nor for an
      // immutable value nobody may fill, which the line above already passed by.
      if (c.required && c.kind !== "switch")
        out[c.field.name] =
          c.kind === "select" || c.kind === "datetime"
            ? words.fieldChoiceRequired(c.label)
            : words.fieldRequired(c.label);
      continue;
    }
    if (c.kind === "number" && numberValue(raw) === undefined)
      out[c.field.name] = words.fieldNumber;
    if (c.kind === "datetime" && timeValue(raw) === undefined) out[c.field.name] = words.fieldTime;
    // The comma is refused on its own, ahead of the item type: a value spelled
    // `1,2` is two integers read out of one item, and the sentence a person can
    // act on is about the comma, not about a type nobody wrote wrong.
    if (c.kind === "list" && valueHoldsSeparator(raw)) out[c.field.name] = words.commaInValue;
    else if (c.kind === "list" && listValues(c.field, raw) === undefined)
      out[c.field.name] = "contains a value that does not match its item type";
  }
  return out;
}

/**
 * changedFields names the controls, in asked order, whose effective value differs
 * from the one the row arrived with: changed, not merely touched. `held` is what a
 * person typed and `Control.value` what the read returned (or the declared default on a
 * create), so retyping the same text, re-picking the same instant or toggling a switch
 * back is no change - and a person who changed nothing is never asked whether they
 * meant to throw it away. Comparison is on what a control means, which is why a
 * switch's "true", a number's "3", a row's own instant and `timeWire`'s spelling of it
 * all match their own row. See `sameAnswer` for the two that do not spell one answer
 * one way.
 */
export function changedFields(
  controls: readonly Control[],
  held: Readonly<Record<string, string>>,
): readonly string[] {
  const out: string[] = [];
  for (const c of controls)
    if (c.field.name in held && !sameAnswer(c, held[c.field.name]!)) out.push(c.field.name);
  return out;
}

/**
 * firstProblem is the field a sheet asks for first: the earliest control in the sheet's
 * own asked order that carries a sentence. The order comes from the controls, never
 * from the key order of `errors`, so a server refusal that names its fields in wire
 * order still focuses the field this person meets first.
 */
export function firstProblem(
  controls: readonly Control[],
  errors: Readonly<Record<string, string>>,
): string | undefined {
  return controls.find((c) => errors[c.field.name] !== undefined)?.field.name;
}
