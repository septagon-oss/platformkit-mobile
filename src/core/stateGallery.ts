// The gallery is a literal set of examples, using the same derivation as apps.
import { deriveState, type StateAction, type StateInput, type StateModel } from "./feedback";
import type { Presentation, Result } from "./presentation";

export interface StateExample {
  readonly id: string;
  readonly model: StateModel;
  readonly renderer: "state" | "spinner";
}

export function stateExamples(p: Presentation): Result<readonly StateExample[]> {
  const { state, gallery } = p.copy;
  const add: StateAction = {
    intent: "next",
    control: { id: "add", label: gallery.add, tone: "primary", state: "ready" },
  };
  const retry: StateAction = {
    intent: "retry-read",
    control: { id: "read", label: state.retry, tone: "primary", state: "ready" },
  };
  const dismiss: StateAction = {
    intent: "dismiss",
    control: { id: "dismiss", label: state.dismiss, tone: "plain", state: "ready" },
  };
  const empty: StateInput = { kind: "empty", action: add };
  const read: StateInput = {
    kind: "error",
    issue: {
      code: "read-failed",
      path: "records",
      recovery: "correctable",
      message: state.error.body,
    },
    action: retry,
  };
  const success: StateInput = { kind: "success", action: dismiss };
  const cases: readonly (readonly [string, StateInput])[] = [
    ["empty-state/with-action", empty],
    ["empty-state/default", empty],
    ["empty-state/read-only", { kind: "empty" }],
    [
      "empty-state/filtered",
      { kind: "empty", title: gallery.filteredTitle, body: gallery.filteredBody },
    ],
    ["empty-state/long-copy", { ...empty, title: gallery.longTitle, body: gallery.longBody }],
    ["empty-state/large-text", { ...empty, title: gallery.longTitle, body: gallery.longBody }],
    [
      "empty-state/action-busy",
      { ...empty, action: { ...add, control: { ...add.control, state: "busy" } } },
    ],
    [
      "empty-state/disabled",
      {
        ...empty,
        action: {
          ...add,
          control: { ...add.control, state: "disabled", reason: gallery.unavailable },
        },
      },
    ],
    ["empty-state/hover", empty],
    ["empty-state/pressed", empty],
    ["empty-state/focus", empty],
    ["notice/error-correctable", read],
    [
      "notice/error-immutable",
      {
        kind: "error",
        issue: {
          code: "forbidden",
          path: "records",
          recovery: "immutable",
          message: gallery.immutable,
        },
        action: dismiss,
      },
    ],
    ["notice/offline", { kind: "offline", action: retry }],
    ["notice/stale-offline", { kind: "offline", updatedAt: "2026-07-18T18:40:00Z", action: retry }],
    [
      "notice/write-unknown",
      {
        kind: "error",
        issue: {
          code: "write-unknown",
          path: "save",
          recovery: "correctable",
          message: state.unknownWrite,
        },
        action: {
          intent: "reconcile",
          control: { id: "reconcile", label: state.reconcile, tone: "primary", state: "ready" },
        },
        secondary: dismiss,
      },
    ],
    ["notice/success", { kind: "success" }],
    ["notice/success-action", success],
    [
      "notice/busy",
      { ...read, action: { ...retry, control: { ...retry.control, state: "busy" } } },
    ],
    [
      "notice/disabled",
      {
        ...read,
        action: {
          ...retry,
          control: { ...retry.control, state: "disabled", reason: state.offline.body },
        },
      },
    ],
    ["notice/hover", read],
    ["notice/pressed", read],
    ["notice/focus", read],
    ["notice/large-text", { ...read, title: gallery.longTitle, body: gallery.longBody }],
    ["skeleton/lines", { kind: "loading", skeleton: "lines" }],
    ["skeleton/rows", { kind: "loading", skeleton: "rows" }],
    ["skeleton/detail", { kind: "loading", skeleton: "detail" }],
    ["skeleton/media", { kind: "loading", skeleton: "media" }],
    ["skeleton/reduced-motion", { kind: "loading", skeleton: "rows" }],
    ["spinner/default", { kind: "loading", skeleton: "lines" }],
    ["spinner/reduced-motion", { kind: "loading", skeleton: "lines" }],
  ];
  const examples: StateExample[] = [];
  for (const [id, input] of cases) {
    const result = deriveState(
      input,
      id.endsWith("/reduced-motion") ? { ...p, motion: "reduced" } : p,
    );
    if (!result.ok) return result;
    examples.push({
      id,
      model: result.value,
      renderer: id.startsWith("spinner/") ? "spinner" : "state",
    });
  }
  return { ok: true, value: examples };
}
