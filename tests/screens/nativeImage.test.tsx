import React, { useState } from "react";
import { expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { View } from "react-native";
import { NativeImage } from "../../src/screens/NativeImage";
import { deriveViewer, type ImageSlotProps, type MediaItem } from "../../src/core/derive";
import { PhotoViewer } from "../../src/ui/organisms/PhotoViewer";
import { ThemeProvider } from "../../src/ui/theme";
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
