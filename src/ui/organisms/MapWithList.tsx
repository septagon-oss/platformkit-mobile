import React, { useLayoutEffect, useCallback, useRef } from "react";
import { View } from "react-native";
import {
  mapViewportAllowed,
  type MapCanvasProps,
  type MapModel,
  type Viewport,
} from "../../core/derive";
import { GroupedListScreen } from "../templates/ListScreen";
import { ActionControl } from "../atoms/ActionControl";
import { Button } from "../atoms/Button";
import { Badge } from "../atoms/Badge";
import { Notice } from "../atoms/Notice";
import { Text } from "../atoms/Text";
import { ActionBar } from "../molecules/ActionBar";
import { ModelState } from "../molecules/ModelState";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export interface Props {
  readonly model: MapModel;
  readonly renderMap: (props: MapCanvasProps) => React.ReactNode;
  readonly renderDetail: (id: string) => React.ReactNode;
  readonly onMode: (mode: "map" | "list") => void;
  readonly onSelect: (id: string) => void;
  readonly onRevealPoints: (ids: readonly string[]) => void;
  readonly onClearSelection: () => void;
  readonly onViewport: (viewport: Viewport) => void;
  readonly onAction: (pointId: string, actionId: string) => void;
  readonly onRetry: () => void;
}
export function MapWithList(props: Props) {
  const { model, renderMap, renderDetail, onMode, onSelect, onClearSelection, onAction, onRetry } =
      props,
    s = useStyles(kitStyles),
    current = useRef<Props | undefined>(props);
  useLayoutEffect(() => {
    current.current = props;
    return () => {
      current.current = undefined;
    };
  }, [props]);
  const onMarker = useCallback((id: string) => {
    const p = current.current;
    if (!p) return;
    const marker = p.model.markers.find((m) => m.id === id);
    if (!marker) return;
    if (marker.ids.length === 1) {
      if (marker.ids[0] !== p.model.selectedId) p.onSelect(marker.ids[0]!);
    } else p.onRevealPoints(marker.ids);
  }, []);
  const onViewport = useCallback((viewport: Viewport) => {
    const p = current.current;
    if (p && mapViewportAllowed(viewport, p.model.capabilities)) p.onViewport(viewport);
  }, []);
  return (
    <GroupedListScreen
      sections={[{ id: "points", data: model.rows }]}
      keyOf={(point) => point.id}
      refreshing={model.refreshing}
      onRefresh={onRetry}
      renderHeading={() => <></>}
      header={
        <View style={s.stack}>
          <View style={s.row}>
            <Button
              label={model.labels.map}
              tone="secondary"
              selected={model.mode === "map"}
              onPress={() => {
                if (model.mode !== "map") onMode("map");
              }}
            />
            <Button
              label={model.labels.list}
              tone="secondary"
              selected={model.mode === "list"}
              onPress={() => {
                if (model.mode !== "list") onMode("list");
              }}
            />
          </View>
          <ModelState model={model} onRetry={onRetry} />
          {model.providerIssue ? (
            <Notice
              text={model.providerIssue}
              announcement="polite"
              {...(model.canRetryProvider
                ? { action: { label: model.labels.retry, onPress: onRetry } }
                : {})}
            />
          ) : null}
          {model.mode === "map" && model.canRender ? (
            <>
              <View style={s.chart}>
                <MapCanvas
                  render={renderMap}
                  markers={model.markers}
                  viewport={model.viewport}
                  attribution={model.attribution}
                  motion={model.motion}
                  onMarker={onMarker}
                  onViewport={onViewport}
                />
              </View>
              <View style={s.row}>
                <Button
                  label={model.labels.zoomIn}
                  tone="secondary"
                  disabled={!model.zoomIn}
                  onPress={() => {
                    if (model.zoomIn) props.onViewport(model.zoomIn);
                  }}
                />
                <Button
                  label={model.labels.zoomOut}
                  tone="secondary"
                  disabled={!model.zoomOut}
                  onPress={() => {
                    if (model.zoomOut) props.onViewport(model.zoomOut);
                  }}
                />
              </View>
            </>
          ) : null}
        </View>
      }
      render={(point) => (
        <View key={point.id} style={s.panel}>
          <Button
            label={point.title}
            tone="secondary"
            selected={point.selected}
            onPress={() => {
              if (!point.selected) onSelect(point.id);
            }}
          />
          {point.subtitle ? <Text>{point.subtitle}</Text> : null}
          <Badge label={point.status.label} tone={point.status.tone} symbol={point.status.symbol} />
          {point.reason ? <Text>{point.reason}</Text> : null}
          {point.open ? (
            <ActionControl model={point.open} onAction={(id) => onAction(point.id, id)} />
          ) : null}
          <ActionBar model={point.bar} onAction={(id) => onAction(point.id, id)} />
        </View>
      )}
      footer={
        <View style={s.stack}>
          <Text role="caption">{model.attribution}</Text>
          {model.selectionIssue ? (
            <Notice text={model.selectionIssue.message} announcement="polite" />
          ) : model.selectedId ? (
            renderDetail(model.selectedId)
          ) : null}
          {model.selectedId ? (
            <Button label={model.labels.clear} tone="plain" onPress={onClearSelection} />
          ) : null}
        </View>
      }
    />
  );
}

function MapCanvas({
  render,
  ...props
}: MapCanvasProps & { readonly render: (props: MapCanvasProps) => React.ReactNode }) {
  return <>{render(props)}</>;
}
