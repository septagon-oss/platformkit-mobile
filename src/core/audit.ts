import type { Action } from "./feedback";
import { instantValue, presentedInstant, type Presentation } from "./presentation";
import {
  action,
  build,
  content,
  pageControl,
  toggle,
  type Content,
  type Page,
  type Validation,
} from "./shared";
export type AuditValue =
  { readonly kind: "value"; readonly text: string } | { readonly kind: "missing" | "redacted" };
export interface Change {
  readonly id: string;
  readonly label: string;
  readonly before: AuditValue;
  readonly after: AuditValue;
}
export interface ActivityItem {
  readonly id: string;
  readonly occurredAt: string;
  readonly verb: string;
  readonly eventCode?: string;
  readonly actor:
    | { readonly kind: "person"; readonly id: string; readonly name?: string }
    | { readonly kind: "system" | "unknown" };
  readonly subject?: string;
  readonly changes: readonly Change[];
  readonly details?: string;
  readonly open?: Action;
}
export interface ActivityInput {
  readonly content: Content<readonly ActivityItem[]>;
  readonly page: Page;
  readonly expandedIds: readonly string[];
  readonly excluded: boolean;
}
export function deriveActivity(input: ActivityInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const base = content(input.content, v);
    const items = input.content.phase === "ready" ? input.content.value : [];
    v.ids(items, "events");
    const rows = items
      .map((item, i) => {
        const at = instantValue(item.occurredAt);
        v.need(at, `events.${i}.occurredAt`);
        // One call, two spellings: the row's own stamp and the words a trail reads
        // aloud come from the same instant and cannot drift.
        const instant = presentedInstant(at, p);
        v.text(item.verb, `events.${i}.verb`);
        v.ids(item.changes, `events.${i}.changes`);
        v.need(["person", "system", "unknown"].includes(item.actor.kind), `events.${i}.actor`);
        if (item.actor.kind === "person") v.text(item.actor.id, `events.${i}.actor.id`);
        const actor =
          item.actor.kind === "person"
            ? (item.actor.name ?? item.actor.id)
            : item.actor.kind === "system"
              ? p.copy.kit.system
              : p.copy.kit.unknownActor;
        const value = (value: AuditValue) => {
          v.need(
            ["value", "missing", "redacted"].includes(value.kind),
            `events.${i}.changes.value`,
          );
          return value.kind === "value"
            ? value.text
            : value.kind === "missing"
              ? p.copy.kit.missing
              : p.copy.kit.redacted;
        };
        return {
          ...item,
          occurredAt: at.toISOString(),
          time: instant.exact,
          actor,
          relative: instant.shown,
          accessibleLabel: `${item.verb} ${p.copy.kit.by} ${actor}, ${instant.exact}`,
          open: item.open ? action(item.open, v, `events.${i}.open`) : undefined,
          changes: item.changes.map((c) => {
            v.text(c.label, `events.${i}.changes.label`);
            return { id: c.id, label: c.label, before: value(c.before), after: value(c.after) };
          }),
          expanded: input.expandedIds.includes(item.id),
          expansion: toggle(input.expandedIds, item.id),
          expandLabel: input.expandedIds.includes(item.id)
            ? p.copy.kit.collapse
            : p.copy.kit.expand,
        };
      })
      .sort(
        (a, b) =>
          b.occurredAt.localeCompare(a.occurredAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      );
    return {
      ...base,
      title: p.copy.kit.activity,
      rows: input.excluded ? [] : rows,
      excluded: input.excluded ? p.copy.kit.excluded : undefined,
      before: p.copy.kit.before,
      after: p.copy.kit.after,
      more: input.excluded
        ? undefined
        : pageControl(input.page, v, input.content.phase === "ready", p.copy.kit.older),
      pageError: input.page.error,
    };
  });
}
export type ActivityModel = Extract<ReturnType<typeof deriveActivity>, { ok: true }>["value"];
