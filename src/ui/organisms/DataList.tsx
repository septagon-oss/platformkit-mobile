import React, { useRef } from "react";
import { View, type LayoutRectangle } from "react-native";
import type { DataListModel, Names, People, PictureStates, Order } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
import { Badge } from "../atoms/Badge";
import { Button } from "../atoms/Button";
import { Notice } from "../atoms/Notice";
import { SelectionControl } from "../atoms/SelectionControl";
import { Text } from "../atoms/Text";
import { ActionBar } from "../molecules/ActionBar";
import { Labelled } from "../molecules/Value";
import { ModelState } from "../molecules/ModelState";
import { Avatar } from "../molecules/Avatar";
import { RowMedia } from "../molecules/RowMedia";
import type { ImageRenderer } from "../molecules/MediaHero";
import { Row } from "../molecules/Row";
import { RolledValue } from "../atoms/RolledValue";
import { GroupedListScreen } from "../templates/ListScreen";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export interface Props {
  readonly people?: People | undefined;
  readonly pictureStates?: PictureStates | undefined;
  readonly renderImage?: ImageRenderer | undefined;
  readonly model: DataListModel;
  /** names resolves the records a cell points at, so a row reads a name where the row holds an identifier. */
  readonly names?: Names | undefined;
  /**
   * onOpen opens one row's record. The frame is where that row's own media stood on the screen the
   * person pressed — filed by the list, read by the record it opens into — and it is absent for a
   * row this phone never measured: a press before the row was laid out, a row that holds no
   * picture, a surface that answers no measurement. The record then opens the way it always did.
   */
  readonly onOpen?: (id: string, frame?: LayoutRectangle) => void;
  readonly onRowAction?: (rowId: string, actionId: string) => void;
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
  names,
  people,
  pictureStates,
  renderImage,
  model,
  onOpen,
  onRowAction,
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
  // Which node each row's picture is drawn in, so that a press can ask where it stood. The list
  // asks for the row being pressed and keeps the node no longer than that row is drawn.
  const tiles = useRef<Record<string, View>>({});
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
          {model.count ? (
            /* The count is a line the person may not be watching when it changes, so it stays a
            live region, and it rolls to its new value rather than replacing the line it stood on. */
            <RolledValue value={model.count} motion={model.feedback.motion} announcement="polite" />
          ) : null}
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
              {section.count ? <Text>{section.count}</Text> : null}
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
            {...(row.avatar
              ? {
                  leading: (
                    <Avatar model={row.avatar} renderImage={renderImage} discOnly decorative />
                  ),
                }
              : row.media
                ? {
                    leading: (
                      <View
                        ref={(node: View | null) => {
                          if (node) tiles.current[row.id] = node;
                          else delete tiles.current[row.id];
                        }}
                      >
                        <RowMedia model={row.media} renderImage={renderImage} />
                      </View>
                    ),
                  }
                : {})}
            cells={row.cells}
            {...(row.summary ? { summary: row.summary } : {})}
            {...(row.cells.some((cell) => cell.field)
              ? {
                  // The same cells, in the shapes their types deserve: a closed set is
                  // a pill, an instant carries a clock, and only a value that cannot
                  // speak for itself ("No", "2") keeps the field's short name. `cells`
                  // stays beside them because a row is one focusable element whose label
                  // is every field it drew, shorthand read aloud in full.
                  shown: (
                    <>
                      {row.cells
                        .filter((cell) => cell.field)
                        .map((cell) => (
                          <Labelled
                            key={cell.id}
                            instance={JSON.stringify([row.id, cell.id])}
                            presentation={model.feedback}
                            field={cell.field!}
                            value={cell.raw}
                            names={names}
                            people={people}
                            pictureStates={pictureStates}
                            renderImage={renderImage}
                          />
                        ))}
                    </>
                  ),
                }
              : {})}
            {...(row.status
              ? {
                  trailing: (
                    <Badge
                      label={row.status.label}
                      tone={row.status.tone}
                      symbol={row.status.symbol}
                      motion={model.feedback.motion}
                    />
                  ),
                }
              : {})}
            {...(row.open?.enabled && onOpen
              ? {
                  onPress: () => {
                    // One press opens one record, however the platform answers where the row's
                    // picture stood. A surface that answers as it is asked (the Fabric native views
                    // do) opens from its answer, which is the only way the frame can be filed before
                    // the record mounts to read it; a surface that answers late, or never, opens from
                    // here and the flight is simply not drawn. The guard is what makes a measurement
                    // that costs the flight never cost the tap, nor a second copy of the record.
                    const tile = tiles.current[row.id];
                    let opened = false;
                    const open = (frame?: LayoutRectangle) => {
                      if (opened) return;
                      opened = true;
                      if (frame === undefined) onOpen(row.id);
                      else onOpen(row.id, frame);
                    };
                    if (typeof tile?.measureInWindow === "function")
                      tile.measureInWindow((x, y, width, height) => open({ x, y, width, height }));
                    open();
                  },
                }
              : {})}
            {...(testID
              ? {
                  testID: rowTestID
                    ? rowTestID(row.id)
                    : `${testID}/row/${encodeURIComponent(row.id)}`,
                }
              : {})}
          />
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
