// State derivation decides which existing atom and which recovery intents may
// be shown. It never starts work, infers a successful write or retries a write.
import {
  hasText,
  instantValue,
  presentationIssues,
  presentedTime,
  type Instant,
  type Issue,
  type Motion,
  type Presentation,
  type Result,
} from "./presentation";

export type Announcement = "none" | "polite" | "urgent";
export type SkeletonVariant = "lines" | "rows" | "detail" | "media";

export interface Action {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly tone: "primary" | "secondary" | "plain" | "destructive";
  readonly state: "ready" | "disabled" | "busy";
  readonly reason?: string;
}

export interface StateAction {
  readonly intent: "next" | "retry-read" | "dismiss" | "reconcile";
  readonly control: Action;
}

interface StateText {
  readonly title?: string;
  readonly body?: string;
}
interface StateActions {
  readonly action?: StateAction;
  readonly secondary?: StateAction;
}
export type StateInput =
  | (StateText & { readonly kind: "loading"; readonly skeleton: SkeletonVariant })
  | (StateText & StateActions & { readonly kind: "empty" | "success" })
  | (StateText & StateActions & { readonly kind: "offline"; readonly updatedAt?: Instant })
  | (StateText &
      StateActions & {
        readonly kind: "error";
        readonly issue: Issue;
        readonly updatedAt?: Instant;
      });

export interface StateControl extends Action {
  readonly intent: StateAction["intent"];
  readonly disabled: boolean;
  readonly busy: boolean;
}

const modelIdentity = Symbol("StateModel");
export interface StateModel {
  readonly [modelIdentity]: true;
  readonly kind: StateInput["kind"];
  readonly component: "empty" | "notice" | "skeleton";
  readonly tone: "danger" | "warning" | "ok";
  readonly icon: "empty" | "warning" | "offline" | "check";
  readonly title: string;
  readonly body: string;
  readonly updatedAt?: string;
  readonly announcement: Announcement;
  readonly announcementText: string;
  readonly language: string;
  readonly motion: Motion;
  readonly loadingLabel: string;
  readonly skeleton: SkeletonVariant;
  readonly actions: readonly StateControl[];
}

/** No partial model on refusal, including when only a secondary action is invalid. */
export function deriveState(input: StateInput, p: Presentation): Result<StateModel> {
  const issues = [...presentationIssues(p)];
  const invalid = (path: string) =>
    issues.push({
      code: "invalid-input" as const,
      path,
      recovery: "immutable" as const,
      message: p.copy.issue.invalid,
    });
  if (!["loading", "empty", "error", "offline", "success"].includes(input.kind)) invalid("kind");
  for (const key of ["title", "body"] as const)
    if (input[key] !== undefined && !hasText(input[key])) invalid(key);
  if (input.kind === "loading" && !["lines", "rows", "detail", "media"].includes(input.skeleton))
    invalid("skeleton");
  const actions: StateControl[] = [];
  const ids = new Set<string>();
  let primary = 0;
  if (input.kind !== "loading") {
    for (const key of ["action", "secondary"] as const) {
      const action = input[key];
      if (!action) continue;
      const { control, intent } = action;
      if (!hasText(control.id) || ids.has(control.id)) invalid(`${key}.control.id`);
      ids.add(control.id);
      if (!hasText(control.label)) invalid(`${key}.control.label`);
      if (control.hint !== undefined && !hasText(control.hint)) invalid(`${key}.control.hint`);
      if (!["ready", "busy", "disabled"].includes(control.state)) invalid(`${key}.control.state`);
      if (
        (control.state === "disabled" || control.reason !== undefined) &&
        !hasText(control.reason)
      )
        invalid(`${key}.control.reason`);
      if (!["primary", "secondary", "plain", "destructive"].includes(control.tone))
        invalid(`${key}.control.tone`);
      if (control.tone === "primary" && ++primary > 1) invalid(`${key}.control.tone`);
      if (!["next", "retry-read", "dismiss", "reconcile"].includes(intent))
        invalid(`${key}.intent`);
      if (input.kind === "error") {
        if (
          (intent === "retry-read" && input.issue.recovery === "immutable") ||
          (input.issue.code === "write-unknown" && intent !== "reconcile" && intent !== "dismiss")
        )
          invalid(`${key}.intent`);
      }
      actions.push(
        Object.freeze({
          ...control,
          intent,
          disabled: control.state !== "ready",
          busy: control.state === "busy",
        }),
      );
    }
  }
  if (input.kind === "error") {
    const immutable = [
      "invalid-input",
      "unsupported-format",
      "forbidden",
      "not-found",
      "read-only",
    ];
    const correctable = [
      "unavailable",
      "busy",
      "validation",
      "conflict",
      "read-failed",
      "offline",
      "write-unknown",
    ];
    if (![...immutable, ...correctable].includes(input.issue.code)) invalid("issue.code");
    if (
      input.issue.recovery !== (immutable.includes(input.issue.code) ? "immutable" : "correctable")
    )
      invalid("issue.recovery");
    if (!hasText(input.issue.message)) invalid("issue.message");
  }
  let updated: Date | undefined;
  if ((input.kind === "offline" || input.kind === "error") && input.updatedAt !== undefined) {
    updated = instantValue(input.updatedAt);
    if (!updated) invalid("updatedAt");
    if (
      input.kind === "error" &&
      (input.issue.code === "forbidden" || input.issue.code === "not-found")
    )
      invalid("updatedAt");
  }
  if (issues.length) return { ok: false, issues };
  const words = p.copy.state;
  const defaults =
    input.kind === "loading" ? { title: words.loading, body: words.loading } : words[input.kind];
  const title = input.title ?? defaults.title;
  const body =
    input.body ??
    (input.kind === "error"
      ? input.issue.code === "write-unknown"
        ? words.unknownWrite
        : input.issue.message
      : defaults.body);
  const updatedAt = updated ? words.updatedAt(presentedTime(updated, p)) : undefined;
  return {
    ok: true,
    value: Object.freeze({
      [modelIdentity]: true as const,
      kind: input.kind,
      component:
        input.kind === "loading" ? "skeleton" : input.kind === "empty" ? "empty" : "notice",
      tone: input.kind === "success" ? "ok" : input.kind === "offline" ? "warning" : "danger",
      icon:
        input.kind === "success"
          ? "check"
          : input.kind === "offline"
            ? "offline"
            : input.kind === "empty"
              ? "empty"
              : "warning",
      title,
      body,
      ...(updatedAt ? { updatedAt } : {}),
      announcement:
        input.kind === "loading" ? "none" : input.kind === "error" ? "urgent" : "polite",
      announcementText: [title, body, updatedAt].filter(Boolean).join(". "),
      language: p.copy.language,
      motion: p.motion,
      loadingLabel: words.loading,
      skeleton: input.kind === "loading" ? input.skeleton : "lines",
      actions: Object.freeze(actions),
    }),
  };
}

/** Legacy callback shape; label derivation has one core owner. */
export function retry(copy: { readonly retryLabel: string }, onPress: () => void) {
  return { label: copy.retryLabel, onPress };
}

/** Refresh failures can retain content; a failed first read is never an empty result. */
export function readPhase(
  loading: boolean,
  count: number,
  error: string,
): "loading" | "error" | "empty" | "ready" {
  if (count > 0) return "ready";
  if (error) return "error";
  return loading ? "loading" : "empty";
}
