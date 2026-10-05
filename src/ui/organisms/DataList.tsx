import React from "react";
import { View } from "react-native";
import type { DataListModel, Order } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
import { Badge } from "../atoms/Badge";
import { Button } from "../atoms/Button";
import { Notice } from "../atoms/Notice";
import { SelectionControl } from "../atoms/SelectionControl";
import { Text } from "../atoms/Text";
import { ActionBar } from "../molecules/ActionBar";
import { ChoiceChips } from "../molecules/ChoiceChips";
import { ModelState } from "../molecules/ModelState";
import { Row } from "../molecules/Row";
import { GroupedListScreen } from "../templates/ListScreen";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export interface Props {
  readonly model: DataListModel;
  readonly onOpen?: (id: string) => void;
  readonly onRowAction?: (rowId: string, actionId: string) => void;
  readonly onOrder?: (order: Order) => void;
  readonly onView?: (id: string) => void;
  readonly onViewAction?: (viewId: string, actionId: string) => void;
  readonly onSaveView?: (value: { readonly order: Order; readonly groupId?: string }) => void;
  readonly onSelection?: (ids: readonly string[]) => void;
  readonly onCollapse?: (ids: readonly string[]) => void;
  readonly onBulkAction?: (id: string, ids: readonly string[]) => void;
  readonly onRefresh?: () => void;
  readonly onMore?: () => void;
  readonly testID?: string | undefined;
  readonly header?: React.ReactNode;
  readonly onStateAction?: (id: string) => void;
  readonly rowTestID?: (id: string) => string;
}
export function DataList({
  model,
  onOpen,
  onRowAction,
  onOrder,
  onView,
  onViewAction,
  onSaveView,
  onSelection,
  onCollapse,
  onBulkAction,
  onRefresh,
  onMore,
  testID,
  header,
  onStateAction,
  rowTestID,
}: Props) {
  const s = useStyles(kitStyles);
  const orderChoice = (group: NonNullable<DataListModel["sort"]>, id: string | undefined) => {
    const target = id === undefined ? group.clear : group.targets.find((c) => c.id === id)?.order;
    if (target) onOrder?.(target);
  };
  return (
    <GroupedListScreen
      sections={model.sections.map((section) => ({
        id: section.id,
        data: section.collapsed ? [] : section.rows,
      }))}
      keyOf={(row) => row.id}
      refreshing={model.refreshing}
      {...(onRefresh ? { onRefresh } : {})}
      testID={testID}
      header={
        <View style={s.stack}>
          {header}
          <ModelState
            model={model}
            {...(onRefresh ? { onRetry: onRefresh } : {})}
            {...(onStateAction ? { onAction: onStateAction } : {})}
          />
          {onOrder
            ? model.filters.map((filter) => (
                <ChoiceChips
                  key={filter.model.id}
                  model={filter.model}
                  onChange={(id) => orderChoice(filter, id)}
                />
              ))
            : null}
          {onOrder && model.sort ? (
            <ChoiceChips model={model.sort.model} onChange={(id) => orderChoice(model.sort!, id)} />
          ) : null}
          {model.views.map((view) => (
            <View key={view.id}>
              {onView ? (
                <Button
                  label={view.label}
                  selected={view.selected}
                  tone="secondary"
                  onPress={() => {
                    if (!view.selected) onView(view.id);
                  }}
                />
              ) : (
                <Text>{view.label}</Text>
              )}
              {onViewAction ? (
                <ActionBar
                  model={{ label: model.labels.views, actions: view.actions }}
                  onAction={(id) => onViewAction(view.id, id)}
                />
              ) : null}
            </View>
          ))}
          {model.viewDirty ? <Text>{model.viewDirty}</Text> : null}
          {model.viewIssue ? <Notice text={model.viewIssue.message} announcement="polite" /> : null}
          {model.saveView && onSaveView ? (
            <ActionControl model={model.saveView} onAction={() => onSaveView(model.saveTarget)} />
          ) : null}
          {model.count ? <Text accessibilityLiveRegion="polite">{model.count}</Text> : null}
          {model.selectionIssue ? (
            <Notice text={model.selectionIssue.message} announcement="polite" />
          ) : null}
          {model.selectAll && onSelection ? (
            <SelectionControl
              model={model.selectAll}
              onChange={() => onSelection(model.allTarget)}
            />
          ) : null}
          {onBulkAction ? (
            <ActionBar model={model.bulk} onAction={(id) => onBulkAction(id, model.selectedIds)} />
          ) : null}
        </View>
      }
      renderHeading={(id) => {
        const section = model.sections.find((item) => item.id === id)!;
        return (
          <View style={s.groupHeader}>
            <View style={s.groupWords}>
              <Text role="title" accessibilityRole="header">
                {section.title}
              </Text>
              <Text>{section.count}</Text>
            </View>
            {section.collapse && onCollapse ? (
              <Button
                label={section.collapse.label}
                tone="plain"
                expanded={!section.collapsed}
                onPress={() => onCollapse(section.collapse!.target)}
              />
            ) : null}
          </View>
        );
      }}
      render={(row) => (
        <View style={s.panel}>
          <Row
            title={row.title}
            cells={row.cellLabels}
            {...(row.summary ? { summary: row.summary } : {})}
            {...(row.open?.enabled && onOpen ? { onPress: () => onOpen(row.id) } : {})}
            {...(testID
              ? {
                  testID: rowTestID
                    ? rowTestID(row.id)
                    : `${testID}/row/${encodeURIComponent(row.id)}`,
                }
              : {})}
          />
          {row.status ? (
            <Badge label={row.status.label} tone={row.status.tone} symbol={row.status.symbol} />
          ) : null}
          {row.selection && onSelection ? (
            <SelectionControl
              model={row.selection}
              onChange={() => onSelection(row.selectionTarget)}
            />
          ) : null}
          {onRowAction ? (
            <ActionBar
              model={{ label: model.bulk.label, actions: row.actions }}
              onAction={(id) => onRowAction(row.id, id)}
            />
          ) : null}
        </View>
      )}
      footer={
        <View style={s.stack}>
          {model.pageError ? <Notice text={model.pageError} announcement="urgent" /> : null}
          {model.more && onMore ? <ActionControl model={model.more} onAction={onMore} /> : null}
        </View>
      }
    />
  );
}
