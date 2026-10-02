import type { Action } from "./feedback";
import type { Presentation } from "./presentation";
import {
  action,
  actions,
  build,
  content,
  issue,
  status,
  type Content,
  type Status,
  type Validation,
} from "./shared";
export interface MapPoint {
  readonly id: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly status: Status;
  readonly open?: Action;
  readonly actions: readonly Action[];
}
export interface Viewport {
  readonly longitude: number;
  readonly latitude: number;
  readonly zoom: number;
}
export interface MapCapabilities {
  readonly latitudeBounds: readonly [number, number];
  readonly zoomBounds: readonly [number, number];
}
export interface MapInput {
  readonly content: Content<readonly MapPoint[]>;
  readonly mode: "map" | "list";
  readonly selectedId?: string;
  readonly viewport: Viewport;
  readonly legend: readonly Status[];
  readonly capabilities: MapCapabilities;
  readonly providerState: "loading" | "ready" | "offline" | "error" | "unsupported";
  readonly providerMessage?: string;
  readonly attribution: string;
}
export interface MapCanvasProps {
  readonly markers: readonly {
    readonly id: string;
    readonly longitude: number;
    readonly latitude: number;
    readonly label: string;
    readonly status: Status;
    readonly selected: boolean;
  }[];
  readonly viewport: Viewport;
  readonly attribution: string;
  readonly motion: "none" | "normal";
  readonly onMarker: (id: string) => void;
  readonly onViewport: (viewport: Viewport) => void;
}
const statusKey = (s: Status) => JSON.stringify([s.label, s.tone, s.symbol]);
export function deriveMap(input: MapInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const base = content(input.content, v),
      { latitudeBounds: lat, zoomBounds: zoom } = input.capabilities;
    const bounds = (pair: readonly [number, number], min: number, max: number) =>
      pair.length === 2 &&
      pair.every(Number.isFinite) &&
      pair[0] >= min &&
      pair[1] <= max &&
      pair[0] < pair[1];
    v.need(bounds(lat, -90, 90), "capabilities.latitudeBounds");
    v.need(bounds(zoom, 0, 22), "capabilities.zoomBounds");
    v.need(input.mode === "map" || input.mode === "list", "mode");
    v.need(
      ["loading", "ready", "offline", "error", "unsupported"].includes(input.providerState),
      "providerState",
    );
    const position = (longitude: number, latitude: number) =>
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180 &&
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90;
    v.need(
      position(input.viewport.longitude, input.viewport.latitude) &&
        Number.isFinite(input.viewport.zoom) &&
        input.viewport.zoom >= 0 &&
        input.viewport.zoom <= 22,
      "viewport",
    );
    v.text(input.attribution, "attribution");
    const keys = new Set<string>();
    input.legend.forEach((s, i) => {
      status(s, v, `legend.${i}`);
      const key = statusKey(s);
      v.need(!keys.has(key), `legend.${i}`);
      keys.add(key);
    });
    const points = input.content.phase === "ready" ? input.content.value : [];
    v.ids(points, "points");
    const rows = points.map((point, i) => {
      v.text(point.title, `points.${i}.title`);
      v.need(position(point.longitude, point.latitude), `points.${i}.coordinates`);
      status(point.status, v, `points.${i}.status`);
      v.need(keys.has(statusKey(point.status)), `points.${i}.status`);
      return {
        ...point,
        selected: point.id === input.selectedId,
        reason:
          point.latitude < lat[0] || point.latitude > lat[1]
            ? p.copy.kit.unsupportedLocation
            : undefined,
        open: point.open ? action(point.open, v, `points.${i}.open`) : undefined,
        bar: {
          label: p.copy.kit.actions,
          actions: actions(
            point.actions,
            v,
            `points.${i}.actions`,
            base.writable ? undefined : p.copy.kit.unavailable,
          ),
        },
      };
    });
    const locations = new Map<string, typeof rows>();
    rows
      .filter((row) => !row.reason)
      .forEach((row) => {
        const key = JSON.stringify([row.longitude, row.latitude]);
        locations.set(key, [...(locations.get(key) ?? []), row]);
      });
    const markers = [...locations.values()].map((group) => ({
      id: group.map((row) => row.id).sort()[0]!,
      longitude: group[0]!.longitude,
      latitude: group[0]!.latitude,
      label: group.length === 1 ? group[0]!.title : `${p.copy.kit.points}: ${group.length}`,
      status:
        group.length === 1
          ? group[0]!.status
          : {
              label: `${p.copy.kit.points}: ${group.length}`,
              tone: "neutral" as const,
              symbol: "none" as const,
            },
      selected: group.some((row) => row.selected),
      ids: group.map((row) => row.id),
    }));
    const target = (amount: number) => {
      const next = { ...input.viewport, zoom: input.viewport.zoom + amount };
      return next.zoom >= zoom[0] &&
        next.zoom <= zoom[1] &&
        next.latitude >= lat[0] &&
        next.latitude <= lat[1]
        ? next
        : undefined;
    };
    const supported =
      input.viewport.latitude >= lat[0] &&
      input.viewport.latitude <= lat[1] &&
      input.viewport.zoom >= zoom[0] &&
      input.viewport.zoom <= zoom[1];
    return {
      legend: { title: p.copy.kit.legend, entries: input.legend },
      map: {
        ...base,
        mode: input.mode,
        rows,
        markers,
        viewport: input.viewport,
        capabilities: input.capabilities,
        attribution: input.attribution,
        motion: p.motion === "reduced" ? ("none" as const) : ("normal" as const),
        canRender:
          (input.providerState === "ready" || input.providerState === "loading") && supported,
        canRetryProvider:
          supported && (input.providerState === "error" || input.providerState === "offline"),
        providerIssue:
          input.providerState === "ready" && supported
            ? undefined
            : (input.providerMessage ??
              (input.providerState === "loading"
                ? p.copy.state.loading
                : p.copy.issue.unsupported)),
        selectedId: input.selectedId,
        selectionIssue:
          input.selectedId && !rows.some((row) => row.selected)
            ? issue(p, "selectedId", "unavailable")
            : undefined,
        zoomIn: target(1),
        zoomOut: target(-1),
        labels: {
          map: p.copy.kit.map,
          list: p.copy.kit.list,
          zoomIn: p.copy.kit.zoomIn,
          zoomOut: p.copy.kit.zoomOut,
          clear: p.copy.kit.clear,
          retry: p.copy.state.retry,
        },
      },
    };
  });
}
export type MapModel = Extract<ReturnType<typeof deriveMap>, { ok: true }>["value"]["map"];
export type MapLegendModel = Extract<ReturnType<typeof deriveMap>, { ok: true }>["value"]["legend"];
export function mapViewportAllowed(viewport: Viewport, capabilities: MapCapabilities): boolean {
  return (
    Number.isFinite(viewport.longitude) &&
    viewport.longitude >= -180 &&
    viewport.longitude <= 180 &&
    Number.isFinite(viewport.latitude) &&
    viewport.latitude >= capabilities.latitudeBounds[0] &&
    viewport.latitude <= capabilities.latitudeBounds[1] &&
    Number.isFinite(viewport.zoom) &&
    viewport.zoom >= capabilities.zoomBounds[0] &&
    viewport.zoom <= capabilities.zoomBounds[1]
  );
}
