/** steps: the form the server resolved as steps, walked one asked group at a time. */
import type { Entry } from "../catalog";
import { STEPPED_LAYOUT, type PolicyStep } from "../catalogPolicy";
import type { Problem, Step, StepEvent } from "../stepper";
import { type Control, type FormBlock, kind } from "./controls";
import { type FormWords, problems } from "./problems";

/** STEPPED_LAYOUT is the layout word the policy door judges a form by (`../catalogPolicy`). */
export { STEPPED_LAYOUT };

/** stepFields is a resolved step's own list, read past the null an older server prints for it. */
const stepFields = (step: PolicyStep): readonly string[] => step.fields ?? [];

/**
 * steppedForm is the entry's resolved stepped form for one mode, or `undefined`
 * when the entry asks that form flat.
 *
 * The answer is the server's step list in its order, member for member: nothing
 * here counts sections, invents a step or splits a field list. A block that names
 * no `forms`, a form laid out some other way, and an entry with no supported policy
 * are the same answer — the one scroll the phone draws today — because the stepped
 * layout is opt-in per form, and a block this build cannot trust already cost the
 * entry its whole policy at the parse (`../catalogPolicy`).
 */
export function steppedForm(e: Entry, create: boolean): readonly PolicyStep[] | undefined {
  const form = create ? e.resolved?.layout.forms?.createForm : e.resolved?.layout.forms?.updateForm;
  // A form the block states but leaves unstepped, or whose steps a nil prints, is flat.
  const steps = form?.steps;
  return form === undefined ||
    form.layout !== STEPPED_LAYOUT ||
    steps === null ||
    steps === undefined
    ? undefined
    : steps;
}

/**
 * stepBlocks is the walk as data: one block per step, in the server's order, each
 * holding the controls that name a field of that step and nothing else, in the
 * order the step asks them.
 *
 * Controls are `formControls`' answer, so a picture, a frozen value or a field the
 * author hid stays off the screen and inside the body exactly as it does on the flat
 * sheet (`writeControls` adds them back). A step the sheet would draw empty drops out
 * of the walk — an empty heading over an empty card is the fault 0085 photographs —
 * and a walk left with no block at all is not a walk: `[]` means the person gets the
 * scroll the entry asks for today.
 */
export function stepBlocks(
  steps: readonly PolicyStep[],
  controls: readonly Control[],
): readonly FormBlock[] {
  return steps.flatMap((step) => {
    const names = stepFields(step);
    const own = controls.filter((c) => names.includes(c.field.name));
    return own.length === 0 ? [] : [{ key: step.key, label: step.label, controls: own }];
  });
}

/**
 * stepProblems is one step's own refusals: the same `problems` the sheet runs before
 * a write, asked of that step's controls only, in the order the step asks them. This
 * is the whole of what Next refuses; the write itself still refuses on the whole form.
 */
export function stepProblems(
  step: PolicyStep,
  controls: readonly Control[],
  held: Readonly<Record<string, string>>,
  words: FormWords,
): readonly Problem[] {
  const own = controls.filter((c) => stepFields(step).includes(c.field.name));
  const stated = problems(own, held, words);
  return stepFields(step)
    .filter((name) => stated[name] !== undefined)
    .map((name) => ({ fieldId: name, message: stated[name]! }));
}

/**
 * stepOwning names the step a refusal belongs to: the earliest step in the server's
 * order holding a field the refusal names, and inside it the earliest field named.
 * The order the sentences arrived in — a 422 lists what the server checked, not what
 * the person should mend first — decides nothing, so the walk always returns to the
 * one step it has to. `undefined` means no refused field sits on any step, which
 * leaves the person where they were with the sentence named over the sheet.
 */
export function stepOwning(
  steps: readonly PolicyStep[],
  refused: Readonly<Record<string, unknown>>,
): string | undefined {
  return steps.find((step) => stepFields(step).some((name) => refused[name] !== undefined))?.key;
}

/**
 * stepVerb is the label the step's primary button wears, read the way the kernel reads
 * its own answer label: a step that names no answer field says its literal verb;
 * otherwise the answer's own trimmed text, and the step's empty label while the answer
 * is empty or that field carries a sentence. For a closed set each comma-separated
 * part is replaced by that option's label, and one part this phone cannot read means
 * the empty label rather than a raw value wearing a button. The surviving text
 * replaces the step's single `{answer}` token. No component restates this rule.
 */
export function stepVerb(
  step: PolicyStep,
  controls: readonly Control[],
  held: Readonly<Record<string, string>>,
  refused: Readonly<Record<string, unknown>>,
): string {
  if (step.answerField === "" || !step.primaryLabel.includes("{answer}")) return step.primaryLabel;
  const answer = controls.find((c) => c.field.name === step.answerField);
  const raw = (held[step.answerField] ?? answer?.value ?? "").trim();
  if (raw === "" || refused[step.answerField] !== undefined) return step.emptyLabel;
  const parts = raw.split(",").map((part) => part.trim());
  // An open box says what it holds; a closed set says its answers' labels, because a
  // person reads "Terracotta, Ivory" and never the id a row stores for a colour.
  const read =
    answer === undefined || answer.options.length === 0 ? parts : readOptions(answer, parts);
  if (read === undefined) return step.emptyLabel;
  return step.primaryLabel.replace("{answer}", read.join(", "));
}

/** readOptions replaces each comma-separated part with its option's own label, or says one is unreadable. */
function readOptions(answer: Control, parts: readonly string[]): readonly string[] | undefined {
  const labels = new Map(answer.options.map((o) => [o.value, o.label]));
  const out: string[] = [];
  for (const part of parts) {
    const label = labels.get(part);
    if (label === undefined) return undefined;
    out.push(label);
  }
  return out;
}

/**
 * walkSteps is the walk as the stepper's own stages: the server's key as the stage id,
 * its label as the stage word, the fields it asks so a refusal can find it, and its
 * verb — read from the answers held now, so the button says what the person chose. A
 * stage is skippable exactly when nothing on it is owed.
 */
export function walkSteps(
  blocks: readonly FormBlock[],
  steps: readonly PolicyStep[],
  held: Readonly<Record<string, string>>,
  refused: Readonly<Record<string, unknown>>,
): Step[] {
  return blocks.flatMap((block) => {
    const step = steps.find((s) => s.key === block.key);
    return step === undefined
      ? []
      : [
          {
            id: step.key,
            label: step.label,
            fields: stepFields(step),
            primary: stepVerb(step, block.controls, held, refused),
            optional: !block.controls.some((c) => c.required && c.kind !== "switch"),
            completion: "incomplete" as const,
            problems: [],
          },
        ];
  });
}

/**
 * stepRefusals is what a refused write says to a walk: one event naming every field
 * the write refused, which `stepTransition` spreads over the steps that asked them
 * and answers with the earliest such step.
 */
export function stepRefusals(errors: Readonly<Record<string, string>>): StepEvent {
  return {
    kind: "refused",
    problems: Object.entries(errors).map(([fieldId, message]) => ({ fieldId, message })),
  };
}
