// The server's resolved presentation policy, judged once per entry. A block this
// build cannot read costs the entry its policy and nothing else: the entry is
// then drawn by the phone's own derivation, never half by one and half by the other.
import { z } from "zod";
import {
  zResolved,
  zResolvedField,
  zResolvedIdentity,
  zResolvedReading,
  zResolvedReference,
  zResolvedTime,
} from "../generated/zod.gen";
import { issuePath } from "./responses";

/**
 * SUPPORTED_POLICY_VERSION is the newest `resolved.policyVersion` this build reads.
 *
 * The kernel versions the block apart from the catalogue document and adds members
 * without moving it, so only a change of meaning raises the number. It goes up in
 * this file when the readers in `derivePolicy.ts` learn that meaning.
 */
export const SUPPORTED_POLICY_VERSION = 1;

/**
 * STEPPED_LAYOUT is the only word a resolved form may lay itself out with, and the
 * word the kernel's `ResolveForm` answers every other layout with a refusal for.
 */
export const STEPPED_LAYOUT = "steps";

// The contract prints a member the server left unset by saying nothing: `group`,
// `reference`, `money` and `time` are members of an object, absent rather than
// filled with a null. A server older than that prints `null` for the same absence,
// which reads the same way, so this shape admits both and a kernel that has not
// moved yet still gives this phone a policy. Money and group are read by nothing,
// so they enter as `unknown`.
const policyShape = zResolved
  .pick({ policyVersion: true, titles: true, layout: true, list: true })
  .extend({
    identity: zResolvedIdentity.extend({ group: z.nullish(z.unknown()) }),
    fields: z
      .array(
        zResolvedField.extend({
          reference: zResolvedReference.nullish(),
          // A resolved choice is judged where it is read (`./choice`), which names the one
          // answer or axis that is wrong and leaves the rest of the question standing. Read
          // strictly here, a bad group list would cost the entry its labels, columns and
          // sort sheet too.
          choice: z.unknown().optional(),
          reading: zResolvedReading.extend({
            money: z.nullish(z.unknown()),
            time: zResolvedTime.nullish(),
          }),
        }),
      )
      .nullable(),
  });

type Shape = z.output<typeof policyShape>;

/** Forms, PolicyForm and PolicyStep are the resolved form block, one form and one step. */
type Forms = NonNullable<Shape["layout"]["forms"]>;
export type PolicyForm = NonNullable<Forms["createForm"]>;
export type PolicyStep = NonNullable<PolicyForm["steps"]>[number];

/** PolicyField is how the server resolved one field of an entry. */
export type PolicyField = Readonly<NonNullable<Shape["fields"]>[number]>;

/** Policy is the part of `resolved` the readers use; members added later are not carried. */
export type Policy = Readonly<Omit<Shape, "fields">> & { readonly fields: readonly PolicyField[] };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

type Notice = (at: string, why: string) => void;

/**
 * referencedNames is every field name the adopted block states, read or not: its
 * title candidates and the field it calls a record by, its summary line, its
 * picture and its summary list, every part of its layout, its sorts and its
 * filters. A pointer into the schema is a pointer into *this* entry, so a name
 * none of the entry's fields answers means the block was resolved against a
 * different schema than the one served beside it, and no part of it can be
 * trusted. Only the empty name is skipped: the kernel prints "" for the member it
 * deliberately left unset (no summary line, no pill, no cover), which is an answer
 * rather than a pointer.
 */
function referencedNames(p: Pick<Shape, "titles" | "layout" | "list">): readonly string[] {
  const filled = (names: readonly string[] | null | undefined): readonly string[] =>
    (names ?? []).filter((n) => n !== "");
  return [
    ...filled(p.titles.listCandidates),
    ...filled(p.titles.recordCandidates),
    ...filled(p.titles.summary),
    p.titles.status,
    p.titles.preview,
    p.titles.cover,
    p.titles.thumbnail,
    ...filled(p.layout.columns),
    ...filled(p.layout.create),
    ...filled(p.layout.update),
    ...filled(p.layout.overview),
    ...filled(p.layout.information),
    ...filled((p.layout.sections ?? []).flatMap((s) => s.fields ?? [])),
    ...filled(p.list.sorts?.map((s) => s.field)),
    ...filled(p.list.filters?.map((f) => f.field)),
    ...stepNames(p.layout),
  ].filter((n) => n !== "");
}

/** FORMS are the three members a resolved `layout.forms` may hold, in the order it prints them. */
const FORMS = ["createForm", "updateForm", "inputForm"] as const;

/**
 * stepNames is every field a stepped form points at: each field each step asks and the
 * one field whose answer each step's verb wears. A step is a pointer list like a column
 * or a section, so a name the entry has no field of means the block was resolved against
 * a different schema than the one served beside it.
 */
function stepNames(layout: Shape["layout"]): readonly string[] {
  return FORMS.flatMap((which) =>
    (layout.forms?.[which]?.steps ?? []).flatMap((step) => [
      ...(step.fields ?? []),
      step.answerField,
    ]),
  );
}

/**
 * stepsAreSound walks a stepped declaration this build cannot trust and says the first
 * thing that is wrong through `notice` — one sentence, the ending every other policy
 * refusal wears — answering false so the entry is drawn without the server's policy.
 * zod cannot say these things: they are the kernel's own checks in
 * `kit/entity/present/forms.go`, stated here between the two lists the block already
 * carries, so no second reading of "what a form asks" exists beside `layout.create`
 * and `layout.update`.
 *
 * A form must lay itself out as steps, state at least one step, give each step a key of
 * its own and at least one field, ask no field on two steps, and — for the two forms
 * whose editable list the block itself carries — ask exactly the fields that list names.
 * A typed-read form is checked for all but that last: this build opens no typed read, so
 * it holds no editable list of its own to hold that block to, and which set the server
 * grouped is the server's to print. The copy of a step follows the kernel's `stepCopy`: a
 * literal verb that is not blank, holds at most one `{answer}` token and no other brace;
 * with a token, an answer field on that very step and a non-empty empty label; without
 * one, neither.
 */
function stepsAreSound(layout: Shape["layout"], at: string, notice: Notice): boolean {
  const stepCopyIsSound = (step: PolicyStep, fields: readonly string[]): string | undefined => {
    if (step.primaryLabel.trim() === "") return "names no primary label";
    const tokens = step.primaryLabel.split("{answer}").length - 1;
    const literal = step.primaryLabel.replace(/\{answer\}/g, "");
    if (tokens > 1) return "wears more than one answer token";
    if (literal.includes("{") || literal.includes("}")) return "wears a token it does not fill";
    if (tokens === 1) {
      if (!fields.includes(step.answerField))
        return "wears its answer token for a field it does not ask";
      if (step.emptyLabel.trim() === "") return "wears its answer token with no empty label";
      return undefined;
    }
    return step.answerField === "" && step.emptyLabel === ""
      ? undefined
      : "wears a literal label and answer properties";
  };
  const formIsSound = (
    which: (typeof FORMS)[number],
    form: PolicyForm,
    editable: readonly string[] | null | undefined,
  ): string | undefined => {
    if (form.layout !== STEPPED_LAYOUT) return `${which} is laid out as "${form.layout}"`;
    const steps = form.steps ?? [];
    if (steps.length === 0) return `${which} states no step`;
    const keys = new Set<string>();
    const asked: string[] = [];
    for (const step of steps) {
      if (step.key === "") return `${which} holds a step with no key`;
      if (keys.has(step.key)) return `${which} repeats the step ${step.key}`;
      keys.add(step.key);
      const fields = step.fields ?? [];
      if (fields.length === 0) return `step ${step.key} of ${which} asks no field`;
      const copy = stepCopyIsSound(step, fields);
      if (copy !== undefined) return `step ${step.key} of ${which} ${copy}`;
      asked.push(...fields);
    }
    const twice = asked.find((name, at) => asked.indexOf(name) !== at);
    if (twice !== undefined) return `${which} asks the field ${twice} on two steps`;
    if (editable === undefined || editable === null) return undefined;
    // The block and the layout name one set each, read either way round: a field one of
    // them holds alone means the steps were resolved against another form than the served
    // one, and no step of that block can be trusted to ask what the person is editing.
    const apart = [
      ...editable.filter((n) => !asked.includes(n)),
      ...asked.filter((n) => !editable.includes(n)),
    ];
    if (apart.length > 0)
      return `${which} does not ask exactly the fields it edits (${apart.join(", ")})`;
    return undefined;
  };
  const edited: Record<(typeof FORMS)[number], readonly string[] | null | undefined> = {
    createForm: layout.create,
    updateForm: layout.update,
    inputForm: undefined,
  };
  for (const which of FORMS) {
    const form = layout.forms?.[which];
    if (form === undefined) continue;
    const refusal = formIsSound(which, form, edited[which]);
    if (refusal !== undefined) {
      notice(at, `${refusal}: the entry is drawn without the server's policy`);
      return false;
    }
  }
  return true;
}

/**
 * readPolicy is the entry's resolved block when this build supports it, else
 * `undefined` after saying why, once, through `notice`. A block that is absent is
 * an older server and is not worth a word. Nothing here throws: the block is an
 * enhancement of the entry, not part of its document shape.
 *
 * Supported means a whole `policyVersion` no newer than SUPPORTED_POLICY_VERSION,
 * every member the readers use present and typed, every field name the block
 * states a field of the entry with each field of the entry described by the block,
 * and — where a form of it is stepped — a step list that asks that form's editable
 * set once. Members this build does not know are ignored; members it does not read
 * are still checked, because one entry is read one way and a block that points
 * anywhere else was not resolved for this entry.
 */
export function readPolicy(
  raw: unknown,
  at: string,
  fieldNames: readonly string[],
  notice: Notice,
): Policy | undefined {
  if (raw === undefined) return undefined;
  const refuse = (why: string): undefined => {
    notice(at, `${why}: the entry is drawn without the server's policy`);
    return undefined;
  };
  if (!isRecord(raw)) return refuse("is not an object");
  const version = raw.policyVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1)
    return refuse("policyVersion is not a whole version");
  if (version > SUPPORTED_POLICY_VERSION)
    return refuse(
      `policyVersion ${version} is newer than this build reads (${SUPPORTED_POLICY_VERSION})`,
    );
  const parsed = policyShape.safeParse(raw);
  if (!parsed.success) return refuse(`is malformed at ${issuePath(parsed.error)}`);
  const { fields, ...rest } = parsed.data;
  const described = (fields ?? []).map((f) => f.name);
  const unknown = [...described, ...referencedNames(parsed.data)].find(
    (n) => !fieldNames.includes(n),
  );
  if (unknown !== undefined) return refuse(`names the unknown field ${unknown}`);
  const missing = fieldNames.find((n) => !described.includes(n));
  if (missing !== undefined) return refuse(`does not describe the field ${missing}`);
  if (!stepsAreSound(parsed.data.layout, at, notice)) return undefined;
  return { ...rest, fields: fields ?? [] };
}
