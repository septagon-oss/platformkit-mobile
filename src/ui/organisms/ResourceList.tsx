// Catalog input is adapted by core to the one shared list renderer. The row, the
// two order sheets and the toolbar that opens them all come from the same read of
// the entry and the order, so the count on a button, the rows in the sheet it opens
// and the empty state a filter leaves behind cannot disagree.
import React from "react";
import type { Entry } from "../../core/catalog";
import {
  deriveCatalogList,
  deriveFilterSheet,
  deriveListToolbar,
  deriveSortSheet,
  type Presentation,
  type Order,
  type Row as Item,
} from "../../core/derive";
import { Notice } from "../atoms/Notice";
import { ActionBar } from "../molecules/ActionBar";
import { ChoiceRows } from "../molecules/ChoiceRows";
import { Actions, type Props as ActionsProps } from "./Actions";
import { DataList } from "./DataList";
import { DetailSheet } from "../templates/DetailSheet";
export interface Props {
  readonly presentation: Presentation;
  readonly entry: Entry;
  readonly rows: readonly Item[];
  readonly total: number;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly more: boolean;
  readonly error: string;
  readonly order: Order;
  /** sheet is which of the two order sheets the person has opened, if either. */
  readonly sheet?: "none" | "sort" | "filters";
  /** onSheet opens one sheet or closes whichever is open; only one is ever open. Without it no
   * control is drawn, because a control that opens nothing is a lie about the screen. */
  readonly onSheet?: (sheet: "none" | "sort" | "filters") => void;
  readonly onOrder: (order: Order) => void;
  readonly onOpen: (id: string) => void;
  readonly onMore: () => void;
  readonly onRefresh: () => void;
  readonly onNew?: () => void;
  /** actions are the commands about the whole list rather than one row. */
  readonly actions?: ActionsProps;
}

export function ResourceList(props: Props) {
  const {
    presentation,
    entry,
    order,
    sheet = "none",
    onSheet,
    onOpen,
    onOrder,
    onMore,
    onRefresh,
    onNew,
    actions,
    ...input
  } = props;
  const result = deriveCatalogList({ entry, order, ...input, canCreate: !!onNew }, presentation);
  const toolbar = deriveListToolbar(
    {
      entry,
      order,
      rows: result.ok ? result.value.sections.reduce((n, s) => n + s.rows.length, 0) : 0,
    },
    presentation,
  );
  const sorts = deriveSortSheet({ open: sheet === "sort", entry }, presentation);
  const narrowing = deriveFilterSheet({ open: sheet === "filters", entry, order }, presentation);
  if (!result.ok || !toolbar.ok || !sorts.ok || !narrowing.ok)
    return (
      <Notice
        text={[result, toolbar, sorts, narrowing].find((r) => !r.ok)?.issues[0]?.message ?? ""}
        announcement="urgent"
      />
    );
  const model = result.value;
  // Nothing opens a sheet without a screen that asked for one, so the way out of a
  // sheet that is not there is the same no-op as the control that was never drawn.
  const close = () => onSheet?.("none");
  // A choice answers with the order the model already computed for it, so the sheet
  // and the list ask the same endpoint the same way. Choosing a sort is the whole
  // answer — the sheet goes with it. A filter stays open: a person narrowing a list
  // usually narrows it twice.
  const chooseSort = (id: string) => {
    const target = model.sort?.targets.find((c) => c.id === id)?.order;
    if (target) onOrder(target);
    close();
  };
  const chooseFilter = (groupId: string, id: string) => {
    const target = model.filters
      .find((f) => f.model.id === groupId)
      ?.targets.find((c) => c.id === id)?.order;
    if (target) onOrder(target);
  };
  return (
    <>
      <DataList
        model={model}
        onOpen={onOpen}
        onMore={onMore}
        onRefresh={onRefresh}
        onStateAction={(id) => {
          if (id === "new") onNew?.();
          else if (id === "refresh") onRefresh();
          // The empty state's way out is the same order the sheet's foot action sets:
          // the filters go, the sort stays.
          else if (id === "clear-filters") onOrder({ ...order, filters: {} });
        }}
        testID="resource-list"
        rowTestID={(id) => `row-${id}`}
        header={
          actions || (onSheet && toolbar.value.bar.actions.length > 0) ? (
            <>
              {actions ? <Actions {...actions} /> : null}
              {/* The list's two doors sit under its header, not in it: the header says
                  what the screen is, this row says how it is being read. */}
              {onSheet ? (
                <ActionBar
                  model={toolbar.value.bar}
                  testID="list-toolbar"
                  onAction={(id) => onSheet(id === "filters" ? "filters" : "sort")}
                />
              ) : null}
            </>
          ) : null
        }
      />
      {model.sort ? (
        <DetailSheet model={sorts.value.surface} testID="sort-sheet" onRequestClose={close}>
          <ChoiceRows model={model.sort.model} named={false} testID="sort" onChange={chooseSort} />
        </DetailSheet>
      ) : null}
      <DetailSheet
        model={narrowing.value.surface}
        testID="filter-sheet"
        onRequestClose={close}
        {...(narrowing.value.clearTarget
          ? {
              onAction: (id: string) => {
                if (id === "clear-filters") onOrder(narrowing.value.clearTarget!);
              },
            }
          : {})}
      >
        {model.filters.map((filter) => (
          <ChoiceRows
            key={filter.model.id}
            model={filter.model}
            testID="filters"
            onChange={(id) => chooseFilter(filter.model.id, id)}
          />
        ))}
      </DetailSheet>
    </>
  );
}
