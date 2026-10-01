import { subject, verb, type Event } from "./activity";
import { deriveActivity, type ActivityItem } from "./audit";
import { deriveState } from "./feedback";
import type { Presentation } from "./presentation";
import { build, type Validation, type Content } from "./shared";
export interface EventTrail {
  readonly events: readonly Event[];
  readonly names: Readonly<Record<string, string>>;
  readonly loading: boolean;
  readonly error: string;
  /** A refused session cannot keep a readable cached trail. */
  readonly denied?: boolean;
  readonly more: boolean;
  readonly excluded?: boolean;
  readonly loadingMore: boolean;
}
export function deriveEventActivity(input: EventTrail, p: Presentation) {
  return build(p, (v: Validation) => {
    const items: readonly ActivityItem[] = (input.denied ? [] : input.events).map((e) => ({
      id: e.id,
      occurredAt: e.occurredAt,
      verb: verb(e),
      eventCode: e.name,
      subject: subject(e),
      actor: e.actor
        ? {
            kind: "person",
            id: e.actor,
            ...(input.names[e.actor] ? { name: input.names[e.actor] } : {}),
          }
        : { kind: "system" },
      changes: [],
    }));
    let content: Content<readonly ActivityItem[]>;
    if (items.length)
      content = { phase: "ready", value: items, refresh: input.loading ? "loading" : "idle" };
    else if (input.denied || input.error)
      content = {
        phase: "error",
        state: v.take(
          deriveState(
            {
              kind: "error",
              issue: {
                code: input.denied ? "forbidden" : "read-failed",
                path: "activity",
                recovery: input.denied ? "immutable" : "correctable",
                message: input.error || p.copy.kit.unavailable,
              },
            },
            p,
          ),
        ),
      };
    else if (input.loading) content = { phase: "loading" };
    else
      content = {
        phase: "empty",
        state: v.take(deriveState({ kind: "empty", body: p.copy.kit.activityEmpty }, p)),
      };
    return v.take(
      deriveActivity(
        {
          content,
          page: {
            more: !input.denied && input.more,
            loading: !input.denied && input.loadingMore,
            ...(items.length && input.error ? { error: input.error } : {}),
          },
          excluded: input.excluded ?? false,
          expandedIds: [],
        },
        p,
      ),
    );
  });
}
