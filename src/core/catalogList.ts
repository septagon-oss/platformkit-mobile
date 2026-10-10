import type { Entry } from "./catalog";
import {
  activeFilters,
  enumLabel,
  fieldLabel,
  filtered,
  filterFields,
  listRow,
  noun,
  nounPhrase,
  readPhase,
  sortOptions,
  text,
  type Order,
  type Row,
} from "./derive";
import {
  deriveDataList,
  deriveActions,
  type ActionBarModel,
  type DataSection,
  type Filter,
} from "./collections";
import { deriveState, type Action } from "./feedback";
import { deriveSurface, type SurfaceModel } from "./surfaces";
import type { Presentation } from "./presentation";
import { build, countText, type Content, type Validation } from "./shared";

export interface CatalogListInput {
  readonly entry: Entry;
  readonly rows: readonly Row[];
  readonly total: number;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly more: boolean;
  readonly error: string;
  readonly order: Order;
  readonly canCreate: boolean;
}

/**
 * deriveCatalogList is a served page of one entry read as a list: one row per
 * record (`listRow`), the two choice groups its sheets hold, and the state that
 * answers when nothing arrived.
 *
 * The sort and filter groups are built here and *reused* by the sheets below: the
 * sheet a person opens and the count on the button that opened it are the same
 * `Order` read twice, never two derivations that can disagree.
 */
export function deriveCatalogList(input: CatalogListInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const { entry } = input,
      named = nounPhrase(entry),
      isFiltered = filtered(input.order),
      phase = readPhase(input.loading, input.rows.length, input.error);
    const state = input.error
      ? v.take(
          deriveState(
            {
              kind: "error",
              issue: {
                code: "read-failed",
                path: "list",
                recovery: "correctable",
                message: input.error,
              },
              action: {
                intent: "retry-read",
                control: {
                  id: "refresh",
                  label: p.copy.state.retry,
                  tone: "plain",
                  state: "ready",
                },
              },
            },
            p,
          ),
        )
      : undefined;
    const sections: readonly DataSection[] = [
      {
        id: "records",
        title: noun(entry).plural,
        rows: input.rows.map((row) => ({
          ...listRow(entry, row, p, p.copy.kit.untitled),
          id: text(row.id),
          selectable: false,
          actions: [],
          open: { id: "open", label: p.copy.kit.open, tone: "plain", state: "ready" },
        })),
        total: input.total,
        collapsible: false,
      },
    ];
    const content: Content<readonly DataSection[]> =
      phase === "ready"
        ? {
            phase: "ready",
            value: sections,
            refresh: state ? "error" : input.refreshing ? "loading" : "idle",
            ...(state ? { notice: state } : {}),
          }
        : phase === "loading"
          ? { phase: "loading" }
          : phase === "error"
            ? { phase: "error", state: state! }
            : {
                phase: "empty",
                state: v.take(
                  deriveState(
                    // Which of the three empties this is, and what to do about it,
                    // are two different questions and the copy table answers both in
                    // both languages. Nothing is composed out of English here: a list
                    // narrowed to nothing says so and offers the way back, and a list
                    // that holds nothing because it is new says that instead — which
                    // is why `filtered`, and not the sort, decides between them.
                    isFiltered
                      ? {
                          kind: "empty",
                          title: p.copy.kit.noMatching(named.plural),
                          body: p.copy.kit.filteredBody,
                          ...(input.canCreate
                            ? {
                                action: {
                                  intent: "next" as const,
                                  control: {
                                    id: "new",
                                    label: p.copy.kit.newNamed(named.singular),
                                    tone: "primary" as const,
                                    state: "ready" as const,
                                  },
                                },
                              }
                            : {}),
                          secondary: {
                            intent: "next" as const,
                            control: {
                              id: "clear-filters",
                              label: p.copy.kit.clearFilters,
                              tone: "secondary" as const,
                              state: "ready" as const,
                            },
                          },
                        }
                      : {
                          kind: "empty",
                          title: p.copy.kit.emptyNone(named.plural),
                          body: input.canCreate
                            ? p.copy.kit.emptyCreate(named.singular)
                            : p.copy.kit.emptyArrive(named.plural),
                          ...(input.canCreate
                            ? {
                                action: {
                                  intent: "next" as const,
                                  control: {
                                    id: "new",
                                    label: p.copy.kit.newNamed(named.singular),
                                    tone: "primary" as const,
                                    state: "ready" as const,
                                  },
                                },
                              }
                            : {}),
                        },
                    p,
                  ),
                ),
              };
    const filters: readonly Filter[] = filterFields(entry).map((field) => {
      const choices = [
        { id: "all", label: p.copy.kit.all, value: "", enabled: true },
        ...(field.enum ?? []).map((value) => ({
          id: `value:${value}`,
          label: enumLabel(field, value),
          value,
          enabled: true,
        })),
      ];
      return {
        id: field.name,
        field: field.name,
        label: fieldLabel(field),
        choices,
        selectedId:
          choices.find((c) => c.value === (input.order.filters[field.name] ?? ""))?.id ?? "missing",
        // A group always answers, even when the answer is "everything": the choice
        // that narrows nothing is one of the choices, so no reset sits inside it.
        required: true,
      };
    });
    const sortChoices = sortOptions(entry, p).map((option, i) => ({
      id: `sort:${i}`,
      label: option.label,
      value: option.value,
      enabled: true,
    }));
    const result = v.take(
      deriveDataList(
        {
          content,
          order: input.order,
          filters,
          sort: {
            id: "sort",
            label: p.copy.kit.sort,
            choices: sortChoices,
            selectedId: sortChoices.find((c) => c.value === input.order.sort)?.id ?? "missing",
            required: true,
          },
          views: [],
          viewDirty: false,
          selection: "none",
          selectedIds: [],
          collapsedIds: [],
          bulkActions: [],
          page: { more: input.more, loading: input.loading },
          total: input.total,
        },
        p,
      ),
    );
    return result;
  });
}

/**
 * SortSheetModel is the sort sheet: a surface, and the name of the choice group
 * the drawer reads its rows from (`model.sort`, whose `targets` hold the `Order`
 * each row produces). The sheet holds no second list of orders.
 */
export interface SortSheetModel {
  readonly surface: SurfaceModel;
  readonly groupId: string;
}
export interface SortSheetInput {
  readonly open: boolean;
  readonly entry: Entry;
}

/**
 * deriveSortSheet is the sheet that replaces the sort chips: the list's own sort
 * group, one row per order, and no foot action — choosing a row *is* the answer,
 * and the sheet goes with it.
 */
export function deriveSortSheet(input: SortSheetInput, p: Presentation) {
  return build(p, (v: Validation) => ({
    surface: sheet(v, p, {
      open: input.open,
      title: p.copy.kit.sort,
      actions: [],
    }),
    groupId: "sort",
  }));
}

/** FilterSheetModel is the filters sheet and the answers its rows arrive with. */
export interface FilterSheetModel {
  readonly surface: SurfaceModel;
  readonly groupIds: readonly string[];
  /** beside the foot's "Clear filters": what to set the order to. Sorting survives. */
  readonly clearTarget?: Order;
}
export interface FilterSheetInput {
  readonly open: boolean;
  readonly entry: Entry;
  readonly order: Order;
}

/**
 * deriveFilterSheet is one group per filterable field, each already answered by
 * "All", and the one action that can empty them all.
 *
 * "Clear filters" appears only when something is filtered: a control that clears
 * nothing is a lie about the state of the screen. It clears the filters and keeps
 * the sort, because ordering is not narrowing and a person who clears what they
 * filtered stays where they were reading.
 */
export function deriveFilterSheet(input: FilterSheetInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const count = activeFilters(input.order, input.entry);
    return {
      surface: sheet(v, p, {
        open: input.open,
        title: p.copy.kit.filters,
        actions:
          count === 0
            ? []
            : [
                {
                  id: "clear-filters",
                  label: p.copy.kit.clearFilters,
                  tone: "secondary" as const,
                  state: "ready" as const,
                },
              ],
      }),
      groupIds: filterFields(input.entry).map((f) => f.name),
      ...(count === 0 ? {} : { clearTarget: { ...input.order, filters: {} } }),
    };
  });
}

/**
 * ToolbarModel is the row of controls under the header and the figure its filters
 * button carries.
 */
export interface ToolbarModel {
  readonly bar: ActionBarModel;
  readonly activeFilters: number;
}
export interface ToolbarInput {
  readonly entry: Entry;
  readonly order: Order;
  /** rows is what is on screen right now, which is what decides whether controls exist. */
  readonly rows: number;
}

/**
 * deriveListToolbar is the two doors a list keeps under its header, not in it.
 *
 * Neither is offered on a list that holds nothing and has nothing filtered: an
 * empty collection has no order to change, and the controls for it on an empty
 * screen answer a question nobody asked. Once anything is filtered both stay, even
 * with no rows, because the screen that says "no matching notes" must hold the way
 * back. The filters door is absent, never disabled, on an entry with nothing to
 * filter by.
 *
 * The count names only filters. A sort is not counted because a sort is not
 * narrowing, and "Filters · 2" that counted an order would tell a person two
 * things were left out when one was only put in another sequence. The bar itself is
 * named for the bar (`listControls`), not for one of the two doors it holds: the
 * accessible name of a group that repeated a button inside it would say the bar is
 * that button.
 */
export function deriveListToolbar(input: ToolbarInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const count = activeFilters(input.order, input.entry);
    const offered = input.rows > 0 || count > 0;
    const fields = filterFields(input.entry);
    return {
      bar: v.take(
        deriveActions(
          {
            label: p.copy.kit.listControls,
            actions: !offered
              ? []
              : [
                  {
                    id: "sort",
                    label: p.copy.kit.sort,
                    tone: "plain" as const,
                    state: "ready" as const,
                  },
                  ...(fields.length === 0
                    ? []
                    : [
                        {
                          id: "filters",
                          label:
                            count === 0
                              ? p.copy.kit.filters
                              : p.copy.kit.filtersActive(countText(count, p)),
                          tone: "plain" as const,
                          state: "ready" as const,
                        },
                      ]),
                ],
          },
          p,
        ),
      ),
      activeFilters: count,
    };
  });
}

/**
 * sheet is the surface both sheets are made of: a title, a way out that is the
 * system's own word, a body that may always be dismissed, and the foot it was given.
 */
function sheet(
  v: Validation,
  p: Presentation,
  input: {
    readonly open: boolean;
    readonly title: string;
    readonly actions: readonly Action[];
  },
): SurfaceModel {
  return v.take(
    deriveSurface(
      {
        open: input.open,
        title: input.title,
        close: { id: "close", label: p.copy.kit.close, tone: "plain", state: "ready" },
        dismissal: "allowed",
        actions: input.actions,
      },
      p,
    ),
  );
}
