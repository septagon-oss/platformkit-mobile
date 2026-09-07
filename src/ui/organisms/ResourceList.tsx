// ResourceList is the generated list as a pure component: the rows the
// caller loaded, an order and filters the caller applies, and the affordances
// a caller who may write is given. Every column, label and cell comes from
// derive; nothing here knows what an entity is.
import React from "react";
import type { Entry } from "../../core/catalog";
import {
  display,
  filterFields,
  humanize,
  label,
  listCells,
  listPreview,
  narrowed,
  plural,
  sortOptions,
  text,
  type Order,
  type Row as Item,
} from "../../core/derive";
import { ChoiceRow } from "../atoms/ChoiceRow";
import { EmptyState } from "../atoms/EmptyState";
import { Notice } from "../atoms/Notice";
import { LoadMore } from "../molecules/LoadMore";
import { Labelled } from "../molecules/Value";
import { Row } from "../molecules/Row";
import { Section } from "../molecules/Section";
import { ListScreen } from "../templates/ListScreen";
import { Actions, type Props as ActionsProps } from "./Actions";

export interface Props {
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

export function ResourceList({
  entry,
  rows,
  total,
  loading,
  refreshing,
  more,
  error,
  order,
  ordering,
  onOrder,
  onOpen,
  onMore,
  onRefresh,
  onNew,
  actions,
}: Props) {
  const columns = listCells(entry);
  const preview = listPreview(entry);
  const noun = humanize(entry.entity).toLowerCase();
  const nouns = plural(noun);
  const narrow = narrowed(order);
  return (
    <ListScreen
      data={rows}
      keyOf={(r) => text(r.id)}
      loading={loading && rows.length === 0}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onEndReached={() => more && onMore()}
      testID="resource-list"
      header={
        <>
          {error ? <Notice text={error} action={{ label: "Retry", onPress: onRefresh }} /> : null}
          {ordering ? (
            <Section title="Order">
              <ChoiceRow
                label="Sort"
                value={order.sort}
                options={sortOptions(entry)}
                onChange={(sort) => onOrder({ ...order, sort })}
                testID="sort"
              />
              {filterFields(entry).map((f) => (
                <ChoiceRow
                  key={f.name}
                  label={humanize(f.name)}
                  value={order.filters[f.name] ?? ""}
                  options={[
                    { value: "", label: "Any" },
                    ...(f.enum ?? []).map((v) => ({ value: v, label: humanize(v) })),
                  ]}
                  onChange={(v) => {
                    const filters = { ...order.filters };
                    if (v) filters[f.name] = v;
                    else delete filters[f.name];
                    onOrder({ ...order, filters });
                  }}
                  testID={`filter-${f.name}`}
                />
              ))}
            </Section>
          ) : null}
        </>
      }
      render={(row) => (
        <Section>
          <Row
            title={label(entry, row)}
            {...(preview && text(row[preview.name]) ? { summary: text(row[preview.name]) } : {})}
            cells={columns.map((f) => `${humanize(f.name)}: ${display(f, row[f.name])}`)}
            shown={columns.map((f) => (
              <Labelled key={f.name} field={f} value={row[f.name]} />
            ))}
            onPress={() => onOpen(text(row.id))}
            testID={`row-${text(row.id)}`}
          />
        </Section>
      )}
      footer={
        <>
          <LoadMore remaining={Math.max(total - rows.length, 0)} busy={loading} onPress={onMore} />
          {/* Under the list, because a command about the collection is about
              what was just read, and because a header with a third button in
              it is a header nobody reads. */}
          {actions ? <Actions {...actions} /> : null}
        </>
      }
      empty={
        <EmptyState
          title={narrow ? `No ${noun} matches` : `No ${nouns} yet`}
          text={
            narrow
              ? "Change the order or the filters above."
              : onNew
                ? "Add the first one."
                : "What arrives will be listed here."
          }
          {...(onNew && !narrow ? { action: { label: `New ${noun}`, onPress: onNew } } : {})}
        />
      }
    />
  );
}
