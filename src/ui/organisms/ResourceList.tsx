// ResourceList is the generated list as a pure component: the rows the
// caller loaded, an order and filters the caller applies, and the affordances
// a caller who may write is given. Every column, label and cell comes from
// derive; nothing here knows what an entity is.
import React from "react";
import type { Entry } from "../../core/catalog";
import { display, humanize, label, listColumns, text, type Row as Item } from "../../core/derive";
import { ChoiceRow, type Option } from "../atoms/ChoiceRow";
import { EmptyState } from "../atoms/EmptyState";
import { Notice } from "../atoms/Notice";
import { LoadMore } from "../molecules/LoadMore";
import { Row } from "../molecules/Row";
import { Section } from "../molecules/Section";
import { ListScreen } from "../templates/ListScreen";

export interface Order {
  readonly sort: string;
  /** filters are field:value, as the API takes them. */
  readonly filters: Readonly<Record<string, string>>;
}

export const noOrder: Order = { sort: "", filters: {} };

/** sortOptions are the orders a list offers: newest, oldest, then each visible column both ways. */
export function sortOptions(e: Entry): readonly Option[] {
  const out: Option[] = [
    { value: "", label: "Newest first" },
    { value: "createdAt", label: "Oldest first" },
  ];
  for (const f of listColumns(e)) {
    if (f.type === "bool" || f.type === "list" || f.type === "uuid") continue;
    if (f.name === "createdAt") continue;
    out.push({ value: f.name, label: `${humanize(f.name)}, ascending` });
    out.push({ value: "-" + f.name, label: `${humanize(f.name)}, descending` });
  }
  return out;
}

/** filterFields are the fields a list can be narrowed by: the ones with a closed set of values. */
export const filterFields = (e: Entry) => e.fields.filter((f) => f.enum && f.enum.length > 0);

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
}: Props) {
  const columns = listColumns(entry).slice(1, 4);
  const noun = humanize(entry.entity).toLowerCase();
  const narrowed = Object.keys(order.filters).length > 0 || order.sort !== "";
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
            cells={columns.map((f) => `${humanize(f.name)}: ${display(f, row[f.name])}`)}
            onPress={() => onOpen(text(row.id))}
            testID={`row-${text(row.id)}`}
          />
        </Section>
      )}
      footer={
        <LoadMore remaining={Math.max(total - rows.length, 0)} busy={loading} onPress={onMore} />
      }
      empty={
        <EmptyState
          title={narrowed ? `No ${noun} matches` : `No ${noun}s yet`}
          text={
            narrowed
              ? "Change the order or the filters above."
              : onNew
                ? "Add the first one."
                : "What arrives will be listed here."
          }
          {...(onNew && !narrowed ? { action: { label: `New ${noun}`, onPress: onNew } } : {})}
        />
      }
    />
  );
}

/** queryFilters spells an Order's filters as the API takes them. */
export const queryFilters = (order: Order): readonly string[] =>
  Object.entries(order.filters).map(([k, v]) => `${k}:${v}`);
