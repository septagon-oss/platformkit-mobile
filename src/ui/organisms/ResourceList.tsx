// Catalog input is adapted by core to the one shared list renderer. The row, the
// two order sheets and the toolbar that opens them all come from the same read of
// the entry and the order, so the count on a button, the rows in the sheet it opens
// and the empty state a filter leaves behind cannot disagree.
import React from "react";
import type { LayoutRectangle } from "react-native";
import type { Entry } from "../../core/catalog";
import {
  deriveCatalogList,
  deriveFilterSheet,
  deriveListToolbar,
  deriveSortSheet,
  deckEntry,
  rowAction,
  type Names,
  type People,
  type PictureStates,
  type Presentation,
  type Order,
  type Row as Item,
} from "../../core/derive";
import type { ImageRenderer } from "../molecules/MediaHero";
import { Notice } from "../atoms/Notice";
import { Button } from "../atoms/Button";
import { ActionBar } from "../molecules/ActionBar";
import { ChoiceRows } from "../molecules/ChoiceRows";
import { Actions, type Props as ActionsProps } from "./Actions";
import { DataList, type RowActionProps } from "./DataList";
import { DetailSheet } from "../templates/DetailSheet";
export interface Props {
  readonly queue?: { readonly total?: number; readonly loading: boolean; readonly error: string };
  readonly onReview?: () => void;
  readonly onQueueRetry?: () => void;
  readonly people?: People | undefined;
  readonly pictureStates?: PictureStates | undefined;
  readonly renderImage?: ImageRenderer | undefined;
  readonly presentation: Presentation;
  readonly entry: Entry;
  readonly rows: readonly Item[];
  /** names resolves the records the rows point at; see `derive.CatalogListInput`. */
  readonly names?: Names | undefined;
  readonly total: number;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly more: boolean;
  readonly error: string;
  /** savedAt says this page came from the phone rather than the server, and when it last arrived. */
  readonly savedAt?: string;
  readonly order: Order;
  /** sheet is which of the two order sheets the person has opened, if either. */
  readonly sheet?: "none" | "sort" | "filters";
  /** onSheet opens one sheet or closes whichever is open; only one is ever open. Without it no
   * control is drawn, because a control that opens nothing is a lie about the screen. */
  readonly onSheet?: (sheet: "none" | "sort" | "filters") => void;
  readonly onOrder: (order: Order) => void;
  /** onOpen opens one row's record and says where that row's picture stood when it was pressed;
   * absent means the record opens the way it always did. DataList's `onOpen` says who measures. */
  readonly onOpen: (id: string, frame?: LayoutRectangle) => void;
  readonly onMore: () => void;
  readonly onRefresh: () => void;
  readonly onNew?: () => void;
  /** actions are the commands about the whole list rather than one row. */
  readonly actions?: ActionsProps;
  /** onRowRun runs the command one row was swiped to run. Absent, or an entry that names no
   * primary command, means no row of this list swipes. */
  readonly onRowRun?: (id: string) => void;
  /** renderRowAction is the swipe surface the product supplied; see DataList's prop of that name. */
  readonly renderRowAction?: (React.ComponentType<RowActionProps> | undefined) | undefined;
}

export function ResourceList(props: Props) {
  const {
    presentation,
    entry,
    names,
    people,
    pictureStates,
    renderImage,
    order,
    sheet = "none",
    onSheet,
    onOpen,
    onOrder,
    onMore,
    onRefresh,
    onNew,
    actions,
    onRowRun,
    renderRowAction,
    queue,
    onReview,
    onQueueRetry,
    ...input
  } = props;
  // Which verb a row of this list may be swiped to run, resolved once for the whole list: it is
  // the entry's declaration and the command's own words, and no row changes either.
  const swipe = rowAction(entry, presentation.copy);
  const result = deriveCatalogList(
    { entry, order, names, ...input, images: !!renderImage, pictureStates, canCreate: !!onNew },
    presentation,
  );
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
  const review = deckEntry(
    entry,
    queue?.total,
    queue?.loading ?? false,
    queue?.error ?? "",
    presentation,
  );
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
        names={names}
        people={people}
        pictureStates={pictureStates}
        renderImage={renderImage}
        onOpen={onOpen}
        onMore={onMore}
        onRefresh={onRefresh}
        {...(swipe ? { rowAction: swipe } : {})}
        {...(onRowRun ? { onRowRun } : {})}
        {...(renderRowAction ? { renderRowAction } : {})}
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
          review || actions || (onSheet && toolbar.value.bar.actions.length > 0) ? (
            <>
              {review ? (
                <>
                  <Button
                    label={review.label}
                    icon="document"
                    tone="secondary"
                    busy={review.loading}
                    disabled={!review.enabled}
                    onPress={() => onReview?.()}
                    testID="review-queue"
                  />
                  {review.reason ? (
                    <Notice tone="info" text={review.reason} announcement="polite" />
                  ) : null}
                  {review.error ? (
                    <Notice
                      text={review.error}
                      announcement="urgent"
                      {...(onQueueRetry
                        ? { action: { label: review.retry, onPress: onQueueRetry } }
                        : {})}
                    />
                  ) : null}
                </>
              ) : null}
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
          // A test id names which group a choice belongs to: two enum fields would
          // otherwise both emit `filters/all`, and a journey that taps one would be
          // told it found two.
          <ChoiceRows
            key={filter.model.id}
            model={filter.model}
            testID={`filters-${filter.model.id}`}
            onChange={(id) => chooseFilter(filter.model.id, id)}
          />
        ))}
      </DetailSheet>
    </>
  );
}
