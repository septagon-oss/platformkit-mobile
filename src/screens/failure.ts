// The one adapter between a thrown refusal and the classifier: it turns whatever
// a request rejected with into the four facts a `catch` arm can honestly state,
// and asks the pure rule. Every hook calls this rather than reading `e.message`,
// because a second chain of instanceof tests is a second classification.
import { copyLanguage, deriveCopy, type Copy } from "../core/copy";
import {
  classifyFailure,
  noFields,
  withdraws,
  workspaceSubject,
  type FailureContext,
  type FailureFacts,
  type FailureSubject,
  type FailureVerdict,
} from "../core/failure";
import { ApiError, ResponseError } from "../effects/api";

/**
 * A cancellation is the screen leaving, not the server refusing: the transport
 * aborts with an `AbortError`, which is not an `ApiError` at all.
 */
const cancelled = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

export function failureFacts(error: unknown): FailureFacts {
  if (error instanceof ApiError)
    // The deadline is an ApiError whose status is 0 — nothing answered — which is
    // the same fact a rejected fetch states, and gets the same sentence.
    return {
      cancelled: cancelled(error),
      answered: error.status !== 0,
      status: error.status,
      unreadable: error instanceof ResponseError,
      fields: error.fields,
    };
  if (cancelled(error))
    return { cancelled: true, answered: false, status: 0, unreadable: false, fields: noFields };
  return { cancelled: false, answered: false, status: 0, unreadable: false, fields: noFields };
}

export function failureOf(
  error: unknown,
  context: FailureContext,
  subject: FailureSubject,
  copy: Copy,
): FailureVerdict {
  return classifyFailure(failureFacts(error), context, subject, copy);
}

/**
 * What a hook stores: the verdict, and the sentence it draws. A cancellation
 * leaves the screen exactly as it was — nothing is set, nothing is announced — so
 * the text is empty and `withdraws` is false.
 */
export interface Refusal {
  readonly verdict: FailureVerdict;
  readonly text: string;
  readonly withdraws: boolean;
  /** The plan line is not a refusal of this person's action, so it is not red. */
  readonly tone: "danger" | "warning";
}

export function refusalOf(
  error: unknown,
  context: FailureContext,
  subject: FailureSubject,
  copy: Copy,
): Refusal {
  const verdict = failureOf(error, context, subject, copy);
  return {
    verdict,
    text: notice(verdict),
    withdraws: withdraws(verdict),
    tone: verdict.outcome === "plan" ? ("warning" as const) : ("danger" as const),
  };
}

/** What a screen puts in its notice: nothing for a request it abandoned and
 * nothing for field issues, which speak under the fields they coloured. */
export function notice(verdict: FailureVerdict): string {
  switch (verdict.outcome) {
    case "silent":
    case "fields":
      return "";
    default:
      return verdict.text;
  }
}

/** The fields a 422 named, which are the only server words a form may put under a
 * control. Any other refusal names none. */
export function refusalFields(verdict: FailureVerdict): Readonly<Record<string, string>> {
  return verdict.outcome === "fields" ? verdict.fields : noFields;
}

/**
 * The phone's own copy bundle: the words follow the language the device reports,
 * with English behind every other tag. The screens read it through `useFeedback`;
 * the shell needs it for the one refusal it holds — the catalogue it could not open.
 */
export function screenCopy(locale = Intl.DateTimeFormat().resolvedOptions().locale): Copy {
  return deriveCopy(copyLanguage(locale));
}

/** The catalogue load has no resource to name, so its refusal names the workspace. */
export function catalogFailure(error: unknown, copy = screenCopy()): string {
  return notice(failureOf(error, "catalog", workspaceSubject, copy));
}
