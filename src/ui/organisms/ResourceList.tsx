// Catalog input is adapted by core to the one shared list renderer.
import React from "react";
import type { Entry } from "../../core/catalog";
import {
  deriveCatalogList,
  type Presentation,
  type Order,
  type Row as Item,
} from "../../core/derive";
import { Notice } from "../atoms/Notice";
import { Actions, type Props as ActionsProps } from "./Actions";
import { DataList } from "./DataList";
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
  /** ordering shows the sort and filter rows above the list. */
  readonly ordering: boolean;
  readonly onOrder: (order: Order) => void;
  readonly onOpen: (id: string) => void;
  readonly onMore: () => void;
  readonly onRefresh: () => void;
  readonly onNew?: () => void;
  /** actions are the commands about the whole list rather than one row. */
  readonly actions?: ActionsProps;
}

export function ResourceList(props: Props) {
  const { presentation, onOpen, onOrder, onMore, onRefresh, onNew, actions, ...input } = props;
  const result = deriveCatalogList({ ...input, canCreate: !!onNew }, presentation);
  if (!result.ok) return <Notice text={result.issues[0]!.message} announcement="urgent" />;
  return (
    <DataList
      model={result.value}
      onOpen={onOpen}
      onOrder={onOrder}
      onMore={onMore}
      onRefresh={onRefresh}
      onStateAction={(id) => {
        if (id === "new") onNew?.();
        else if (id === "refresh") onRefresh();
      }}
      testID="resource-list"
      rowTestID={(id) => `row-${id}`}
      header={actions ? <Actions {...actions} /> : null}
    />
  );
}
