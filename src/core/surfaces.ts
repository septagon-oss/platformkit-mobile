import { deriveState, type Action, type StateInput } from "./feedback";
import type { Presentation } from "./presentation";
import { action, actions, build } from "./shared";
import type { Validation } from "./shared";
export interface SurfaceInput {
  readonly open: boolean;
  readonly title: string;
  readonly subtitle?: string;
  readonly close: Action;
  readonly dismissal: "allowed" | "confirm" | "blocked";
  readonly reason?: string;
  readonly actions: readonly Action[];
  readonly contentState?: StateInput;
}
export function deriveSurface(input: SurfaceInput, p: Presentation) {
  return build(p, (v: Validation) => {
    v.text(input.title, "title");
    v.need(["allowed", "confirm", "blocked"].includes(input.dismissal), "dismissal");
    if (input.dismissal !== "allowed") v.text(input.reason, "reason");
    return {
      ...input,
      close: action(
        input.close,
        v,
        "close",
        input.dismissal === "blocked" ? input.reason : undefined,
      ),
      canRequestClose: input.dismissal !== "blocked" && input.close.state === "ready",
      gestureDismissal: input.dismissal === "allowed" && input.close.state === "ready",
      bar: { label: p.copy.kit.actions, actions: actions(input.actions, v, "actions") },
      state: input.contentState ? v.take(deriveState(input.contentState, p)) : undefined,
    };
  });
}
export type SurfaceModel = Extract<ReturnType<typeof deriveSurface>, { ok: true }>["value"];
export interface DisclosureInput {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  /** What is behind the control, in the words a screen would use. A control that says
   * only "Expand" leaves a person to open it to find out whether it is worth opening. */
  readonly reveals: string;
  readonly expanded: boolean;
  readonly depth: 1 | 2;
  readonly enabled: boolean;
  readonly reason?: string;
}
export function deriveDisclosure(input: DisclosureInput, p: Presentation) {
  return build(p, (v: Validation) => {
    v.text(input.id, "id");
    v.text(input.title, "title");
    v.text(input.summary, "summary");
    v.text(input.reveals, "reveals");
    v.need(input.depth === 1 || input.depth === 2, "depth", "unsupported-format");
    if (!input.enabled) v.text(input.reason, "reason");
    return {
      ...input,
      control: action(
        {
          id: input.id,
          label: input.expanded
            ? p.copy.disclosure.conceal(input.reveals)
            : p.copy.disclosure.reveal(input.reveals),
          state: input.enabled ? "ready" : "disabled",
          tone: "plain",
          ...(input.reason ? { reason: input.reason } : {}),
        },
        v,
        "control",
      ),
      target: !input.expanded,
    };
  });
}
export type DisclosureModel = Extract<ReturnType<typeof deriveDisclosure>, { ok: true }>["value"];
