import type { Order } from "./derive";
import type { Action } from "./feedback";
import type { Presentation } from "./presentation";
import {
  action,
  actions,
  build,
  content,
  countText,
  issue,
  pageControl,
  status,
  toggle,
  type Content,
  type Page,
  type Status,
  type Validation,
} from "./shared";

export interface Choice {
  readonly id: string;
  readonly label: string;
  readonly count?: number;
  readonly enabled: boolean;
  readonly reason?: string;
}
export interface ChoiceGroup {
  readonly id: string;
  readonly label: string;
  readonly choices: readonly Choice[];
  readonly selectedId?: string;
  readonly required: boolean;
}
export function deriveChoices(input: ChoiceGroup, p: Presentation) {
  return build(p, (v: Validation) => {
    v.text(input.id, "id");
    v.text(input.label, "label");
    v.ids(input.choices, "choices");
    const choices = input.choices.map((c, i) => {
      v.text(c.label, `choices.${i}.label`);
      v.need(typeof c.enabled === "boolean", `choices.${i}.enabled`);
      if (!c.enabled) v.text(c.reason, `choices.${i}.reason`);
      if (c.count !== undefined)
        v.need(Number.isSafeInteger(c.count) && c.count >= 0, `choices.${i}.count`);
      return {
        ...c,
        label: c.count === undefined ? c.label : `${c.label} (${countText(c.count, p)})`,
        selected: input.selectedId === c.id,
        change: c.enabled && c.id !== input.selectedId,
      };
    });
    const valid = choices.some((c) => c.selected && c.enabled);
    return {
      id: input.id,
      label: input.label,
      choices,
      clearLabel: p.copy.kit.clear,
      canClear: !input.required && input.selectedId !== undefined,
      ...(input.selectedId !== undefined && !valid
        ? { issue: issue(p, "selectedId", "unavailable") }
        : {}),
      satisfied: valid || (!input.required && input.selectedId === undefined),
    };
  });
}
export type ChoiceGroupModel = Extract<ReturnType<typeof deriveChoices>, { ok: true }>["value"];
export interface SelectionInput {
  readonly label: string;
  readonly selected: boolean | "mixed";
  readonly enabled: boolean;
  readonly reason?: string;
}
export function deriveSelection(input: SelectionInput, p: Presentation) {
  return build(p, (v: Validation) => {
    v.text(input.label, "label");
    v.need([true, false, "mixed"].includes(input.selected), "selected");
    if (!input.enabled) v.text(input.reason, "reason");
    return { ...input, target: input.selected !== true };
  });
}
export type SelectionModel = Extract<ReturnType<typeof deriveSelection>, { ok: true }>["value"];
export function deriveActions(
  input: { readonly label: string; readonly actions: readonly Action[] },
  p: Presentation,
) {
  return build(p, (v: Validation) => {
    v.text(input.label, "label");
    return { label: input.label, actions: actions(input.actions, v, "actions") };
  });
}
export type ActionBarModel = Extract<ReturnType<typeof deriveActions>, { ok: true }>["value"];
export interface DataRow {
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
  readonly cells: readonly {
    readonly id: string;
    readonly label: string;
    readonly value: string;
  }[];
  readonly status?: Status;
  readonly selectable: boolean;
  readonly selectionReason?: string;
  readonly open?: Action;
  readonly actions: readonly Action[];
}
export interface DataSection {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly DataRow[];
  readonly total?: number;
  readonly collapsible: boolean;
}
export interface Filter extends ChoiceGroup {
  readonly field: string;
  readonly choices: readonly (Choice & { readonly value: string })[];
}
export interface Sort extends ChoiceGroup {
  readonly choices: readonly (Choice & { readonly value: Order["sort"] })[];
}
export interface SavedView {
  readonly id: string;
  readonly label: string;
  readonly order: Order;
  readonly groupId?: string;
  readonly count?: number;
  readonly actions: readonly Action[];
}
export interface DataListInput {
  readonly content: Content<readonly DataSection[]>;
  readonly order: Order;
  readonly filters: readonly Filter[];
  readonly sort?: Sort;
  readonly views: readonly SavedView[];
  readonly selectedViewId?: string;
  readonly viewDirty: boolean;
  readonly saveView?: Action;
  readonly groupId?: string;
  readonly selection: "none" | "multiple";
  readonly selectedIds: readonly string[];
  readonly collapsedIds: readonly string[];
  readonly bulkActions: readonly Action[];
  readonly page: Page;
  readonly total?: number;
}
export function deriveDataList(input: DataListInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const base = content(input.content, v);
    v.need(input.selection === "none" || input.selection === "multiple", "selection");
    v.need(input.selection !== "none" || input.selectedIds.length === 0, "selectedIds");
    v.ids(input.filters, "filters");
    v.ids(input.views, "views");
    const groups = input.content.phase === "ready" ? input.content.value : [];
    v.ids(groups, "sections");
    const all = groups.flatMap((g) => g.rows);
    v.ids(all, "rows");
    const eligible = all.filter((r) => r.selectable).map((r) => r.id);
    const selectedIds = eligible.filter((id) => input.selectedIds.includes(id));
    const selectionIssue = input.selectedIds.some((id) => !eligible.includes(id))
      ? issue(p, "selectedIds", "unavailable")
      : undefined;
    v.need(
      input.collapsedIds.every((id) => groups.some((g) => g.id === id && g.collapsible)),
      "collapsedIds",
    );
    const total = (n: number | undefined, loaded: number, path: string) => {
      if (n !== undefined) v.need(Number.isSafeInteger(n) && n >= loaded, path);
      return n === undefined
        ? `${countText(loaded, p)} ${p.copy.kit.loaded}`
        : `${countText(loaded, p)} ${p.copy.kit.of} ${countText(n, p)}`;
    };
    const count = total(input.total, all.length, "total");
    const sections = groups.map((g, i) => {
      v.text(g.title, `sections.${i}.title`);
      return {
        id: g.id,
        title: g.title,
        count: total(g.total, g.rows.length, `sections.${i}.total`),
        collapsed: input.collapsedIds.includes(g.id),
        collapse: g.collapsible
          ? {
              label: input.collapsedIds.includes(g.id) ? p.copy.kit.expand : p.copy.kit.collapse,
              target: toggle(input.collapsedIds, g.id),
            }
          : undefined,
        rows: g.rows.map((r, j) => {
          const path = `sections.${i}.rows.${j}`;
          v.text(r.title, `${path}.title`);
          v.ids(r.cells, `${path}.cells`);
          r.cells.forEach((c) => v.text(c.label, `${path}.cells.label`));
          status(r.status, v, `${path}.status`);
          const target = eligible.filter((id) =>
            id === r.id ? !selectedIds.includes(id) : selectedIds.includes(id),
          );
          return {
            ...r,
            open: r.open ? action(r.open, v, `${path}.open`) : undefined,
            actions: actions(
              r.actions,
              v,
              `${path}.actions`,
              base.writable ? undefined : p.copy.kit.unavailable,
            ),
            selection:
              input.selection === "multiple"
                ? v.take(
                    deriveSelection(
                      {
                        label: `${p.copy.kit.select}: ${r.title}`,
                        selected: selectedIds.includes(r.id),
                        enabled: r.selectable,
                        ...(!r.selectable
                          ? { reason: r.selectionReason ?? p.copy.kit.unavailable }
                          : {}),
                      },
                      p,
                    ),
                  )
                : undefined,
            selectionTarget: target,
          };
        }),
      };
    });
    const filters = input.filters.map((f) => {
      v.text(f.field, `filters.${f.id}.field`);
      const selected = f.choices.find((c) => c.id === f.selectedId);
      v.need(
        (selected?.value || undefined) === (input.order.filters[f.field] || undefined),
        `filters.${f.id}.selectedId`,
      );
      const targets = f.choices.map((c) => {
        const filters = { ...input.order.filters };
        if (c.value) filters[f.field] = c.value;
        else delete filters[f.field];
        return { id: c.id, order: { ...input.order, filters } };
      });
      const cleared = { ...input.order.filters };
      delete cleared[f.field];
      return {
        model: v.take(deriveChoices(f, p)),
        targets,
        clear: { ...input.order, filters: cleared },
      };
    });
    let sort;
    if (input.sort) {
      const value = input.sort.choices.find((c) => c.id === input.sort!.selectedId)?.value;
      v.need(value === input.order.sort, "sort.selectedId");
      v.need(
        input.sort.choices.some((c) => c.value === ""),
        "sort.choices",
      );
      sort = {
        model: v.take(deriveChoices(input.sort, p)),
        targets: input.sort.choices.map((c) => ({
          id: c.id,
          order: { ...input.order, sort: c.value },
        })),
        clear: { ...input.order, sort: "" },
      };
    }
    const views = input.views.map((view) => ({
      ...view,
      selected: view.id === input.selectedViewId,
      actions: actions(view.actions, v, `views.${view.id}.actions`),
    }));
    const selectedAll = selectedIds.length > 0 && selectedIds.length === eligible.length;
    return {
      ...base,
      sections,
      filters,
      sort,
      views,
      selectedIds,
      selectionIssue,
      count,
      viewDirty: input.viewDirty ? p.copy.kit.unsaved : undefined,
      viewIssue:
        input.selectedViewId && !views.some((view) => view.selected)
          ? issue(p, "selectedViewId", "unavailable")
          : undefined,
      saveView: input.saveView ? action(input.saveView, v, "saveView") : undefined,
      saveTarget: { order: input.order, ...(input.groupId ? { groupId: input.groupId } : {}) },
      bulk: {
        label: p.copy.kit.actions,
        actions: actions(
          input.bulkActions,
          v,
          "bulkActions",
          selectedIds.length && base.writable && !selectionIssue
            ? undefined
            : p.copy.kit.unavailable,
        ),
      },
      selectAll:
        input.selection === "multiple"
          ? v.take(
              deriveSelection(
                {
                  label: p.copy.kit.allLoaded,
                  selected: selectedAll ? true : selectedIds.length ? "mixed" : false,
                  enabled: eligible.length > 0,
                  ...(eligible.length ? {} : { reason: p.copy.kit.unavailable }),
                },
                p,
              ),
            )
          : undefined,
      allTarget: selectedAll ? [] : eligible,
      more: pageControl(input.page, v, input.content.phase === "ready"),
      pageError: input.page.error,
      labels: { filters: p.copy.kit.filters, views: p.copy.kit.views },
      feedback: { ...p, loadingLabel: p.copy.state.loading, retryLabel: p.copy.state.retry },
    };
  });
}
export type DataListModel = Extract<ReturnType<typeof deriveDataList>, { ok: true }>["value"];
