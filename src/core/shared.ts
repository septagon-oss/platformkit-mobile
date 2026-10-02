import { deriveState, type Action, type StateModel } from "./feedback";
import {
  hasText,
  presentationIssues,
  type Issue,
  type IssueCode,
  type Presentation,
  type Result,
} from "./presentation";

export type ID = string;
export interface Status {
  readonly label: string;
  readonly tone: "neutral" | "info" | "ok" | "warning" | "danger";
  readonly symbol: "none" | "check" | "clock" | "warning";
}
export type Content<T> =
  | { readonly phase: "loading" }
  | { readonly phase: "empty" | "error" | "offline"; readonly state: StateModel }
  | {
      readonly phase: "ready";
      readonly value: T;
      readonly refresh: "idle" | "loading" | "error" | "offline";
      readonly notice?: StateModel;
    };
export interface Page {
  readonly more: boolean;
  readonly loading: boolean;
  readonly error?: string;
}
export interface ContentModel {
  readonly state?: StateModel;
  readonly notice?: StateModel;
  readonly refreshing: boolean;
  readonly writable: boolean;
}
export interface Control extends Action {
  readonly enabled: boolean;
  readonly busy: boolean;
}

class Refusal {
  constructor(readonly issues: readonly Issue[]) {}
}
export function issue(p: Presentation, path: string, code: IssueCode = "invalid-input"): Issue {
  const immutable = [
    "invalid-input",
    "unsupported-format",
    "read-only",
    "forbidden",
    "not-found",
  ].includes(code);
  return {
    code,
    path,
    recovery: immutable ? "immutable" : "correctable",
    message:
      code === "unsupported-format"
        ? p.copy.issue.unsupported
        : code === "invalid-input"
          ? p.copy.issue.invalid
          : code === "validation"
            ? p.copy.kit.validation
            : p.copy.kit.unavailable,
  };
}
/** Copy before freezing: derivation never freezes a caller's mutable draft. */
export function immutable<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable)) as T;
  if (value !== null && typeof value === "object") {
    const result = { ...value };
    for (const key of Object.keys(result))
      (result as Record<string, unknown>)[key] = immutable(
        (result as Record<string, unknown>)[key],
      );
    return Object.freeze(result);
  }
  return value;
}
export class Validation {
  constructor(readonly p: Presentation) {}
  need(valid: unknown, path: string, code: IssueCode = "invalid-input"): asserts valid {
    if (!valid) throw new Refusal([issue(this.p, path, code)]);
  }
  text(value: unknown, path: string) {
    this.need(hasText(value), path);
  }
  ids(values: readonly { readonly id: string }[], path: string) {
    const ids = new Set<string>();
    values.forEach((v, i) => {
      this.need(hasText(v.id) && !ids.has(v.id), `${path}.${i}.id`);
      ids.add(v.id);
    });
  }
  take<T>(result: Result<T>): T {
    if (!result.ok) throw new Refusal(result.issues);
    return result.value;
  }
}
export function build<T>(p: Presentation, derive: (v: Validation) => T): Result<T> {
  const problems = presentationIssues(p);
  if (problems.length) return { ok: false, issues: problems };
  try {
    return { ok: true, value: immutable(derive(new Validation(p))) };
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, issues: error.issues };
    throw error;
  }
}
export function action(a: Action, v: Validation, path: string, blocked?: string): Control {
  v.text(a.id, `${path}.id`);
  v.text(a.label, `${path}.label`);
  v.need(["ready", "disabled", "busy"].includes(a.state), `${path}.state`);
  v.need(["primary", "secondary", "plain", "destructive"].includes(a.tone), `${path}.tone`);
  if (a.state === "disabled" || a.reason !== undefined) v.text(a.reason, `${path}.reason`);
  if (a.hint !== undefined) v.text(a.hint, `${path}.hint`);
  return {
    ...a,
    ...(blocked ? { state: "disabled", reason: blocked } : {}),
    enabled: a.state === "ready" && !blocked,
    busy: a.state === "busy",
  };
}
export function actions(
  values: readonly Action[],
  v: Validation,
  path: string,
  blocked?: string,
): readonly Control[] {
  v.ids(values, path);
  v.need(values.filter((a) => a.tone === "primary").length <= 1, path);
  return values.map((a, i) => action(a, v, `${path}.${i}`, blocked));
}
export function status(value: Status | undefined, v: Validation, path: string) {
  if (!value) return;
  v.text(value.label, `${path}.label`);
  v.need(["neutral", "info", "ok", "warning", "danger"].includes(value.tone), `${path}.tone`);
  v.need(["none", "check", "clock", "warning"].includes(value.symbol), `${path}.symbol`);
}
export function content<T>(input: Content<T>, v: Validation): ContentModel {
  v.need(["loading", "empty", "error", "offline", "ready"].includes(input.phase), "content.phase");
  if (input.phase === "loading")
    return {
      state: v.take(deriveState({ kind: "loading", skeleton: "rows" }, v.p)),
      refreshing: false,
      writable: false,
    };
  if (input.phase !== "ready") {
    v.need(input.state.kind === input.phase, "content.state");
    return { state: input.state, refreshing: false, writable: false };
  }
  v.need(["idle", "loading", "error", "offline"].includes(input.refresh), "content.refresh");
  if (input.refresh === "error" || input.refresh === "offline")
    v.need(input.notice?.kind === input.refresh, "content.notice");
  return {
    ...(input.notice ? { notice: input.notice } : {}),
    refreshing: input.refresh === "loading",
    writable: input.refresh === "idle",
  };
}
export function pageControl(
  page: Page,
  v: Validation,
  enabled: boolean,
  label = v.p.copy.kit.more,
): Control | undefined {
  v.need(typeof page.more === "boolean" && typeof page.loading === "boolean", "page");
  if (!page.more) return;
  return action(
    { id: "more", label, tone: "plain", state: page.loading ? "busy" : "ready" },
    v,
    "page",
    enabled ? undefined : v.p.copy.kit.unavailable,
  );
}
export function toggle(ids: readonly string[], id: string): readonly string[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}
export const countText = (n: number, p: Presentation) => new Intl.NumberFormat(p.locale).format(n);
