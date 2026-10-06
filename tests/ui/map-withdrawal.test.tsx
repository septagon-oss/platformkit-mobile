// Map data that was withdrawn cannot keep a marker's detail open or accept a marker press that
// arrived late: the surface answers with what it can still authorise.
import React from "react";
import { View } from "react-native";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  deriveCopy,
  deriveMap,
  deriveState,
  type MapCanvasProps,
  type MapInput,
} from "../../src/core/derive";
import { MapWithList } from "../../src/ui/organisms/MapWithList";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

test.each([
  { language: "en", mode: "light" },
  { language: "en", mode: "dark" },
  { language: "pt", mode: "light" },
  { language: "pt", mode: "dark" },
] as const)(
  "$language/$mode withdrawn map data cannot retain details or accept late marker intent",
  async ({ language, mode }) => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const labels =
      language === "en"
        ? {
            title: "Archive 29",
            annex: "Annex 31",
            update: "Update inspection",
            status: "Needs inspection",
          }
        : {
            title: "Arquivo 29",
            annex: "Anexo 31",
            update: "Atualizar inspeção",
            status: "Requer inspeção",
          };
    const status = { label: labels.status, tone: "warning", symbol: "clock" } as const;
    const input: MapInput = {
      content: {
        phase: "ready",
        refresh: "idle",
        value: [
          {
            id: "archive",
            title: labels.title,
            longitude: 13,
            latitude: 24,
            status,
            actions: [{ id: "inspect", label: labels.update, state: "ready", tone: "primary" }],
          },
          {
            id: "annex",
            title: labels.annex,
            longitude: 14,
            latitude: 25,
            status,
            actions: [],
          },
        ],
      },
      mode: "map",
      selectedId: "archive",
      viewport: { longitude: 13, latitude: 24, zoom: 4 },
      capabilities: { latitudeBounds: [-80, 80], zoomBounds: [1, 18] },
      legend: [status],
      providerState: "ready",
      attribution: "Public fixture",
    };
    const callbacks = {
      onMode: jest.fn(),
      onSelect: jest.fn(),
      onRevealPoints: jest.fn(),
      onClearSelection: jest.fn(),
      onViewport: jest.fn(),
      onAction: jest.fn(),
      onRetry: jest.fn(),
    };
    let canvas: MapCanvasProps | undefined;
    const detail = jest.fn((id: string) => <View testID={`map-detail-${id}`} />);
    const view = (value: MapInput) => {
      const model = deriveMap(value, p);
      if (!model.ok) throw new Error(JSON.stringify(model.issues));
      return (
        <ThemeProvider mode={mode}>
          <View testID="map-surface">
            <MapWithList
              model={model.value.map}
              {...callbacks}
              renderDetail={detail}
              renderMap={(props) => {
                canvas = props;
                return <View testID="map-canvas" />;
              }}
            />
          </View>
        </ThemeProvider>
      );
    };
    await render(view(input));
    expect(screen.getByTestId("map-detail-archive")).toBeOnTheScreen();
    expect(screen.getAllByText(labels.status)).toHaveLength(2);
    const retained = canvas!;
    expect(retained.markers.map((marker) => marker.id)).toEqual(["archive", "annex"]);
    // Use an unselected marker, so a stale model would actually send a selection.
    retained.onMarker("annex");
    expect(callbacks.onSelect.mock.calls).toEqual([["annex"]]);
    callbacks.onSelect.mockClear();
    await fireEvent.press(screen.getByRole("button", { name: labels.update }));
    expect(callbacks.onAction.mock.calls).toEqual([["archive", "inspect"]]);
    callbacks.onAction.mockClear();
    if (input.content.phase !== "ready") throw new Error("Expected the ready test fixture");
    await screen.rerender(view({ ...input, content: { ...input.content, refresh: "loading" } }));
    const pending = screen.getByRole("button", { name: labels.update });
    expect(pending).toBeDisabled();
    await fireEvent.press(pending);
    await fireEvent(pending, "accessibilityAction", { nativeEvent: { actionName: "activate" } });
    expect(callbacks.onAction).not.toHaveBeenCalled();

    for (const code of ["forbidden", "not-found"] as const) {
      const state = deriveState(
        {
          kind: "error",
          issue: { code, path: "points", recovery: "immutable", message: p.copy.kit.unavailable },
        },
        p,
      );
      if (!state.ok) throw new Error(JSON.stringify(state.issues));
      detail.mockClear();
      await screen.rerender(view({ ...input, content: { phase: "error", state: state.value } }));
      // Establish reachability independently of either the denied content or the refusal wording.
      expect(screen.getByTestId("map-surface")).toBeOnTheScreen();
      expect(
        screen.queryByTestId("map-detail-archive", { includeHiddenElements: true }),
      ).toBeNull();
      expect(screen.queryByText(labels.title, { includeHiddenElements: true })).toBeNull();
      expect(screen.queryByText(labels.annex, { includeHiddenElements: true })).toBeNull();
      expect(
        screen.queryByRole("button", { name: labels.update, includeHiddenElements: true }),
      ).toBeNull();
      expect(detail).not.toHaveBeenCalled();
      retained.onMarker("annex");
      for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
    }
    await screen.rerender(view({ ...input, providerState: "unsupported", mode: "list" }));
    expect(screen.queryByTestId("map-canvas")).toBeNull();
    expect(screen.getByTestId("map-detail-archive")).toBeOnTheScreen();
    for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
    await fireEvent(screen.getByRole("button", { name: labels.update }), "accessibilityAction", {
      nativeEvent: { actionName: "activate" },
    });
    expect(callbacks.onAction.mock.calls).toEqual([["archive", "inspect"]]);
    await screen.unmount();
    retained.onMarker("annex");
    retained.onViewport({ longitude: 14, latitude: 25, zoom: 5 });
    expect(callbacks.onSelect).not.toHaveBeenCalled();
    expect(callbacks.onViewport).not.toHaveBeenCalled();
  },
);
