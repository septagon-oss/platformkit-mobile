import type { Action } from "./feedback";
import { deriveCopy } from "./copy";
import type { Issue, Presentation, Result } from "./presentation";
import { action, build, type Control, type Validation } from "./shared";
export interface Problem {
  readonly fieldId: string;
  readonly message: string;
}
export interface Step {
  readonly id: string;
  readonly label: string;
  readonly summary?: string;
  readonly optional: boolean;
  readonly completion: "incomplete" | "complete" | "skipped";
  readonly problems: readonly Problem[];
}
export interface StepperInput {
  readonly steps: readonly Step[];
  readonly currentId?: string;
  readonly phase:
    | "editing"
    | "validating"
    | "saving-exit"
    | "submitting"
    | "failed"
    | "write-unknown"
    | "finished";
  readonly issue?: Issue;
  readonly saveAndExit?: Action;
  readonly finish: Action;
  readonly dirty: boolean;
}
function validate(input: StepperInput, v: Validation) {
  v.ids(input.steps, "steps");
  input.steps.forEach((s, i) => {
    v.text(s.label, `steps.${i}.label`);
    v.need(["incomplete", "complete", "skipped"].includes(s.completion), `steps.${i}.completion`);
    v.need(s.optional || s.completion !== "skipped", `steps.${i}.completion`);
    s.problems.forEach((problem) => {
      v.text(problem.fieldId, `steps.${i}.problems.fieldId`);
      v.text(problem.message, `steps.${i}.problems.message`);
    });
  });
  const index = input.steps.findIndex((s) => s.id === input.currentId);
  v.need(!input.steps.length ? input.currentId === undefined : index >= 0, "currentId");
  v.need(
    [
      "editing",
      "validating",
      "saving-exit",
      "submitting",
      "failed",
      "write-unknown",
      "finished",
    ].includes(input.phase),
    "phase",
  );
  return index;
}
export function deriveStepper(input: StepperInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const index = validate(input, v);
    const editable = input.phase === "editing" || input.phase === "failed";
    const done = input.steps.filter((s) => s.completion !== "incomplete").length;
    const skipped = input.steps.filter((s) => s.completion === "skipped").length;
    const make = (id: string, label: string, available: boolean, busy = false): Control =>
      action(
        {
          id,
          label,
          tone: "secondary",
          state: busy ? "busy" : available ? "ready" : "disabled",
          ...(!available && !busy ? { reason: p.copy.kit.unavailable } : {}),
        },
        v,
        id,
      );
    const current = input.steps[index];
    return {
      steps: input.steps.map((s, i) => {
        const stateLabel =
          s.completion === "complete"
            ? p.copy.kit.complete
            : s.completion === "skipped"
              ? p.copy.kit.skipped
              : p.copy.kit.required;
        return {
          ...s,
          selected: i === index,
          canGo: editable && i < index && s.completion !== "incomplete",
          stateLabel,
          displayLabel: `${s.label} · ${stateLabel}`,
        };
      }),
      currentId: input.currentId,
      progress: input.steps.length ? done / input.steps.length : 0,
      // What the screen says is where the person is, not the arithmetic behind it:
      // "Steps: 1/2; Skipped: 0" is a readout, and a skipped count of nothing is noise.
      progressLabel: `${p.copy.kit.steps}: ${done}/${input.steps.length}; ${p.copy.kit.skipped}: ${skipped}`,
      progressText: skipped
        ? `${p.copy.kit.step} ${index + 1} ${p.copy.kit.of} ${input.steps.length} · ${skipped} ${p.copy.kit.skipped.toLowerCase()}`
        : `${p.copy.kit.step} ${index + 1} ${p.copy.kit.of} ${input.steps.length}`,
      dirty: input.dirty ? p.copy.kit.unsaved : undefined,
      dismissal: input.dirty ? ("confirm" as const) : ("allowed" as const),
      firstProblem: current?.problems[0],
      issue: input.issue,
      finished: input.phase === "finished",
      unknown: input.phase === "write-unknown",
      back: current ? make("back", p.copy.kit.back, editable && index > 0) : undefined,
      next:
        current && index < input.steps.length - 1
          ? make("next", p.copy.kit.next, editable, input.phase === "validating")
          : undefined,
      skip: current?.optional ? make("skip", p.copy.kit.skip, editable) : undefined,
      finish:
        current && index === input.steps.length - 1
          ? action(input.finish, v, "finish", editable ? undefined : p.copy.kit.unavailable)
          : undefined,
      saveAndExit: input.saveAndExit
        ? action(input.saveAndExit, v, "saveAndExit", editable ? undefined : p.copy.kit.unavailable)
        : undefined,
      reconcile:
        input.phase === "write-unknown"
          ? make("reconcile", p.copy.state.reconcile, true)
          : undefined,
    };
  });
}
export type StepperModel = Extract<ReturnType<typeof deriveStepper>, { ok: true }>["value"];
export type StepEvent =
  | { readonly kind: "back" | "skip" }
  | { readonly kind: "go" | "edited"; readonly stepId: string }
  | { readonly kind: "validated"; readonly problems: readonly Problem[] };
/** The optional presentation only localizes refusals; no clock is consulted. */
export function stepTransition(
  input: StepperInput,
  event: StepEvent,
  presentation?: Presentation,
): Result<{ readonly steps: readonly Step[]; readonly currentId?: string }> {
  const p = presentation ?? {
    locale: "en-GB",
    timeZone: "UTC",
    weekStartsOn: 1,
    now: "2000-01-01T00:00:00Z",
    motion: "reduced",
    copy: deriveCopy("en"),
  };
  return build(p, (v: Validation) => {
    const index = validate(input, v);
    v.need(input.phase !== "finished", "phase", "read-only");
    v.need(
      event.kind === "validated"
        ? input.phase === "validating"
        : input.phase === "editing" || input.phase === "failed",
      "phase",
      "busy",
    );
    v.need(index >= 0, "steps", "unavailable");
    let target = index;
    let steps = [...input.steps];
    if (event.kind === "back") {
      v.need(index > 0, "currentId", "unavailable");
      target--;
    } else if (event.kind === "go" || event.kind === "edited") {
      const chosen = steps.findIndex((s) => s.id === event.stepId);
      v.need(chosen >= 0, "stepId");
      if (event.kind === "go")
        v.need(
          chosen <= index &&
            steps.slice(0, chosen).every((s) => s.optional || s.completion !== "incomplete"),
          "stepId",
          "validation",
        );
      else
        steps = steps.map((s, i) =>
          i >= chosen ? { ...s, completion: "incomplete", problems: [] } : s,
        );
      target = chosen;
    } else if (event.kind === "skip") {
      v.need(steps[index]!.optional, "currentId", "validation");
      steps[index] = { ...steps[index]!, completion: "skipped", problems: [] };
      target = Math.min(index + 1, steps.length - 1);
    } else if (event.kind === "validated") {
      event.problems.forEach((problem) => {
        v.text(problem.fieldId, "problems.fieldId");
        v.text(problem.message, "problems.message");
      });
      steps[index] = {
        ...steps[index]!,
        problems: event.problems,
        completion: event.problems.length ? "incomplete" : "complete",
      };
      if (!event.problems.length) target = Math.min(index + 1, steps.length - 1);
    }
    return { steps, currentId: steps[target]!.id };
  });
}
