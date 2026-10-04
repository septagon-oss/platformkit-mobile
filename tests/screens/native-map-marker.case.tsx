import React from "react";
import { expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import type { MapCanvasProps } from "../../src/core/derive";
import { NativeMap } from "../../src/screens/NativeMap.native";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

// Deferred in review 2; run explicitly with --testMatch '**/tests/screens/review-native-map.case.tsx'.

jest.mock("@maplibre/maplibre-react-native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    Map: (props: Readonly<Record<string, unknown>>) =>
      React.createElement("NativeMapDouble", { ...props, testID: "native-map" }),
    Camera: "NativeCameraDouble",
    Marker: "NativeMarkerDouble",
  };
});

const model: MapCanvasProps = {
  markers: [
    {
      id: "collection",
      longitude: 10,
      latitude: 20,
      label: "Collection point",
      status: { label: "Unavailable", tone: "danger", symbol: "warning" },
      selected: false,
    },
  ],
  viewport: { longitude: 10, latitude: 20, zoom: 3 },
  attribution: "Fixture",
  motion: "none",
  onMarker: () => undefined,
  onViewport: () => undefined,
};

test("native map callbacks from an abandoned scope cannot reach the current caller", async () => {
  const onState = jest.fn();
  const onViewport = jest.fn();
  const view = (scope: string) => (
    <ThemeProvider mode="light">
      <NativeMap
        unsupportedLabel={presentation.copy.issue.unsupported}
        model={{ ...model, onViewport }}
        resource={{ scope, version: "v1", styleURL: "https://maps.example.test/style.json" }}
        onState={onState}
      />
    </ThemeProvider>
  );
  await render(view("first-scope"));
  const old = screen.getByTestId("native-map").props;
  await screen.rerender(view("second-scope"));
  old.onDidFinishLoadingMap();
  old.onDidFailLoadingMap();
  old.onRegionDidChange({ nativeEvent: { userInteraction: true, center: [11, 21], zoom: 4 } });
  expect(onState).not.toHaveBeenCalled();
  expect(onViewport).not.toHaveBeenCalled();
  const current = screen.getByTestId("native-map").props;
  current.onDidFinishLoadingMap();
  expect(onState.mock.calls).toEqual([["ready"]]);
  await screen.rerender(view("first-scope"));
  old.onDidFinishLoadingMap();
  expect(onState).toHaveBeenCalledTimes(1);
  const returned = screen.getByTestId("native-map").props;
  await screen.unmount();
  returned.onDidFinishLoadingMap();
  expect(onState).toHaveBeenCalledTimes(1);
});

test("a native map marker communicates its supplied status without relying on color", async () => {
  await render(
    <ThemeProvider mode="light">
      <NativeMap
        unsupportedLabel={presentation.copy.issue.unsupported}
        model={model}
        resource={{
          scope: "scope-a",
          version: "v1",
          styleURL: "https://maps.example.test/style.json",
        }}
        onState={() => undefined}
      />
    </ThemeProvider>,
  );
  expect(
    screen.getByRole("button", {
      name: /Collection point.*Unavailable|Unavailable.*Collection point/,
    }),
  ).toBeOnTheScreen();
});
