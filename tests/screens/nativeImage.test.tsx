import { readFileSync } from "node:fs";
import { Circle } from "react-native-svg";
import React, { useState } from "react";
import { expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { View } from "react-native";
import { NativeImage } from "../../src/screens/NativeImage";
import { deriveViewer, type ImageSlotProps, type MediaItem } from "../../src/core/derive";
import { PhotoViewer } from "../../src/ui/organisms/PhotoViewer";
import { ThemeProvider } from "../../src/ui/theme";
import { svgNodes } from "../fakes/svg";
import { presentation } from "../fakes/presentation";

jest.mock("expo-image", () => ({ Image: "NativeImageDouble" }));

test("replaced and unmounted image sources cannot report into the active scope", async () => {
  const onState = jest.fn();
  const model: ImageSlotProps = {
    id: "photo",
    description: "Portrait",
    decorative: false,
    fit: "contain",
    aspectRatio: 2 / 3,
  };
  const view = (scope: string, slotId = "photo") => (
    <NativeImage
      model={{ ...model, id: slotId }}
      resource={{ id: "photo", scope, version: "v1", uri: "https://images.example.test/photo" }}
      onState={onState}
    />
  );
  await render(view("first-session"));
  const old = screen.getByLabelText("Portrait").props;
  expect(old.cachePolicy).toBe("none");
  await screen.rerender(view("second-session"));
  old.onLoad();
  old.onError();
  expect(onState).not.toHaveBeenCalled();
  const active = screen.getByLabelText("Portrait").props;
  expect(active.recyclingKey).not.toBe(old.recyclingKey);
  active.onLoad();
  expect(onState.mock.calls).toEqual([["photo", "ready"]]);
  await screen.rerender(view("second-session", "next-photo"));
  active.onError();
  expect(onState).toHaveBeenCalledTimes(1);
  await screen.rerender(view("first-session"));
  old.onLoad();
  expect(onState).toHaveBeenCalledTimes(1);
  const returned = screen.getByLabelText("Portrait").props;
  await screen.unmount();
  returned.onError();
  active.onError();
  expect(onState).toHaveBeenCalledTimes(1);
});

test("viewer receives retained image completions and keeps caption and recovery outside zoom", async () => {
  const retry = jest.fn();
  function Viewer() {
    const [state, setState] = useState<MediaItem["state"]>("ready");
    const result = deriveViewer(
      {
        open: true,
        selectedId: "bridge",
        page: { more: false, loading: false },
        content: {
          phase: "ready",
          refresh: "idle",
          value: [
            {
              id: "bridge",
              width: 1500,
              height: 1000,
              description: "Footbridge",
              caption: "Crossing the river",
              decorative: false,
              state,
            },
          ],
        },
      },
      presentation,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    return (
      <ThemeProvider mode="light">
        <PhotoViewer
          model={result.value}
          renderImage={(model) => (
            <NativeImage
              model={model}
              resource={{
                id: "bridge",
                scope: "session",
                version: "v2",
                uri: "https://images.example.test/bridge",
              }}
              onState={(_, next) => setState(next)}
            />
          )}
          renderZoom={({ children }) => <View testID="zoom-frame">{children}</View>}
          onSelect={() => undefined}
          onClose={() => undefined}
          onRetry={(id) => {
            retry(id);
            setState("loading");
          }}
        />
      </ThemeProvider>
    );
  }
  await render(<Viewer />);
  const original = screen.getByLabelText("Footbridge").props;
  await act(() => original.onLoadStart());
  expect(screen.getByRole("progressbar")).toBeOnTheScreen();
  expect(screen.queryByLabelText("Footbridge")).toBeNull();
  await act(() => original.onLoad());
  expect(screen.getByLabelText("Footbridge")).toBeOnTheScreen();
  expect(screen.queryByRole("progressbar")).toBeNull();
  await act(() => original.onError());
  const frame = within(screen.getByTestId("zoom-frame"));
  expect(screen.getByText("Crossing the river")).toBeOnTheScreen();
  expect(frame.queryByText("Crossing the river")).toBeNull();
  expect(frame.queryByRole("button", { name: presentation.copy.kit.retryImage })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: presentation.copy.kit.retryImage }));
  expect(retry.mock.calls).toEqual([["bridge"]]);
  await act(() => original.onLoad());
  expect(screen.getByRole("progressbar")).toBeOnTheScreen();
  const current = screen.getByLabelText("Footbridge", { includeHiddenElements: true }).props;
  await act(() => current.onLoad());
  expect(screen.getByLabelText("Footbridge")).toBeOnTheScreen();
  expect(screen.queryByRole("progressbar")).toBeNull();
});

test("composed Oracle bytes render through the installed SVG parser and tree in the current slot", async () => {
  const xml = readFileSync("testdata/composed-picture.svg", "utf8");
  const onState = jest.fn();
  const resource = {
    kind: "svg" as const,
    scope: "session-a",
    id: "c1.YQ",
    version: "visit-1",
    xml,
  };
  const model: ImageSlotProps = {
    id: "c1.YQ",
    description: "Shape study",
    decorative: false,
    fit: "cover",
    aspectRatio: 1,
  };
  const view = await render(<NativeImage resource={resource} model={model} onState={onState} />);
  expect(svgNodes(screen.toJSON()).find((n) => n.type === "RNSVGCircle")?.props).toMatchObject({
    cx: 25,
    cy: 30,
    r: 12,
    fill: { payload: 0xffaabbcc },
  });
  expect(svgNodes(screen.toJSON()).find((n) => n.type === "RNSVGRect")?.props).toMatchObject({
    width: 100,
    height: 80,
    fill: { payload: 0xffffffff },
  });
  expect(svgNodes(screen.toJSON()).find((n) => n.type === "RNSVGLine")?.props).toMatchObject({
    stroke: { payload: 0xff112233 },
    strokeWidth: 2,
    x1: 15,
    x2: 85,
  });
  expect(svgNodes(screen.toJSON()).find((n) => n.type === "RNSVGSvgView")?.props).toMatchObject({
    width: "100%",
    height: "100%",
    align: "xMidYMid",
    meetOrSlice: 1,
    accessible: true,
    accessibilityLabel: "Shape study",
  });
  expect(onState.mock.calls).toEqual([
    ["c1.YQ", "loading"],
    ["c1.YQ", "ready"],
  ]);
  expect(JSON.stringify(screen.toJSON())).not.toContain("NativeImageDouble");
  await view.rerender(
    <NativeImage
      resource={resource}
      model={{ ...model, fit: "contain", decorative: true }}
      onState={onState}
    />,
  );
  expect(svgNodes(screen.toJSON()).find((n) => n.type === "RNSVGSvgView")?.props).toMatchObject({
    align: "xMidYMid",
    meetOrSlice: 0,
    accessible: false,
  });
  expect(onState).toHaveBeenCalledTimes(2);
});

test.each(["<svg><g></svg>", "<g></g>", "", "no root"])(
  "malformed or rootless composed XML draws nothing and reports only failure: %s",
  async (xml) => {
    const onState = jest.fn();
    await render(
      <NativeImage
        model={{ id: "c1.YQ", fit: "contain", description: "", decorative: true, aspectRatio: 1 }}
        resource={{ kind: "svg", scope: "reader", id: "c1.YQ", version: "v1", xml }}
        onState={onState}
      />,
    );
    expect(svgNodes(screen.toJSON())).toEqual([]);
    expect(onState.mock.calls).toEqual([
      ["c1.YQ", "loading"],
      ["c1.YQ", "error"],
    ]);
    expect(screen.toJSON()).toBeNull();
  },
);

test("an SVG tree render failure withdraws the picture and reports no ready state", async () => {
  const onState = jest.fn();
  const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  const renderTree = jest.spyOn(Circle.prototype, "render").mockImplementation(() => {
    throw new Error("Native SVG view unavailable");
  });
  try {
    await render(
      <NativeImage
        model={{ id: "c1.YQ", fit: "contain", description: "", decorative: true, aspectRatio: 1 }}
        resource={{
          kind: "svg",
          scope: "reader",
          id: "c1.YQ",
          version: "v1",
          xml: '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>',
        }}
        onState={onState}
      />,
    );
    expect(onState.mock.calls).toEqual([
      ["c1.YQ", "loading"],
      ["c1.YQ", "error"],
    ]);
    expect(screen.toJSON()).toBeNull();
  } finally {
    renderTree.mockRestore();
    error.mockRestore();
  }
});

test("a replacement SVG render failure reports into its new resource attempt after commit", async () => {
  const onState = jest.fn();
  const model: ImageSlotProps = {
    id: "c1.YQ",
    fit: "contain",
    description: "",
    decorative: true,
    aspectRatio: 1,
  };
  const resource = {
    kind: "svg" as const,
    id: "c1.YQ",
    scope: "reader",
    version: "first",
    xml: readFileSync("testdata/composed-picture.svg", "utf8"),
  };
  const view = await render(<NativeImage model={model} resource={resource} onState={onState} />);
  const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  const renderTree = jest.spyOn(Circle.prototype, "render").mockImplementation(() => {
    throw new Error("Native SVG view unavailable");
  });
  try {
    onState.mockClear();
    await view.rerender(
      <NativeImage
        model={model}
        resource={{ ...resource, version: "replacement" }}
        onState={onState}
      />,
    );
    expect(onState.mock.calls).toEqual([
      ["c1.YQ", "loading"],
      ["c1.YQ", "error"],
    ]);
    expect(screen.toJSON()).toBeNull();
  } finally {
    renderTree.mockRestore();
    error.mockRestore();
  }
});
