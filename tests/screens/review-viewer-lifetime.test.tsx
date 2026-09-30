import React from "react";
import { expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { deriveCopy, deriveViewer, type MediaItem } from "../../src/core/derive";
import { NativeImage } from "../../src/screens/NativeImage";
import { PhotoViewer } from "../../src/ui/organisms/PhotoViewer";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

// Reuse the existing native-image seam; selection and lifecycle owners stay real.
jest.mock("expo-image", () => ({ Image: "NativeImageDouble" }));

test("T0180: viewer recovery retains the active loader without reviving an abandoned selection", async () => {
  const onState = jest.fn();
  const onRetry = jest.fn();
  const onSelect = jest.fn();
  const p = { ...presentation, copy: deriveCopy("pt"), locale: "pt-PT" };
  const photos: readonly MediaItem[] = [
    {
      id: "orchard",
      description: "Pomar em flor",
      width: 900,
      height: 1200,
      decorative: false,
      state: "ready",
    },
    {
      id: "pond",
      description: "Lago ao amanhecer",
      width: 1600,
      height: 900,
      decorative: false,
      state: "ready",
    },
  ];
  function view(selectedId: string, state: MediaItem["state"]) {
    const result = deriveViewer(
      {
        open: true,
        selectedId,
        content: {
          phase: "ready",
          refresh: "idle",
          value: photos.map((item) => (item.id === selectedId ? { ...item, state } : item)),
        },
        page: { more: false, loading: false },
      },
      p,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    return (
      <ThemeProvider mode="dark">
        <PhotoViewer
          model={result.value}
          renderImage={(model) => (
            <NativeImage
              model={model}
              resource={{
                id: model.id,
                scope: "review-session",
                version: "image-rev-3",
                uri: `https://images.example.test/${model.id}`,
              }}
              onState={onState}
            />
          )}
          renderZoom={({ children }) => <>{children}</>}
          onSelect={onSelect}
          onRetry={onRetry}
          onClose={() => undefined}
        />
      </ThemeProvider>
    );
  }

  await render(view("orchard", "loading"));
  expect(screen.getByRole("button", { name: p.copy.kit.close })).toBeOnTheScreen();
  expect(screen.getByRole("progressbar")).toBeOnTheScreen();
  const orchard = screen.getByLabelText("Pomar em flor", { includeHiddenElements: true }).props;
  await act(() => orchard.onLoad());
  expect(onState.mock.calls).toEqual([["orchard", "ready"]]);
  await screen.rerender(view("orchard", "ready"));
  expect(screen.getByLabelText("Pomar em flor")).toBeOnTheScreen();
  expect(screen.queryByRole("progressbar")).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: p.copy.kit.next }));
  expect(onSelect.mock.calls).toEqual([["pond"]]);
  await screen.rerender(view("pond", "loading"));
  const pond = screen.getByLabelText("Lago ao amanhecer", { includeHiddenElements: true }).props;
  await act(() => {
    orchard.onLoad();
    orchard.onError();
    pond.onLoad();
  });
  expect(onState.mock.calls).toEqual([
    ["orchard", "ready"],
    ["pond", "ready"],
  ]);

  await screen.rerender(view("pond", "unavailable"));
  await fireEvent.press(screen.getByRole("button", { name: p.copy.kit.retryImage }));
  expect(onRetry.mock.calls).toEqual([["pond"]]);
  await act(() => pond.onLoad());
  expect(onState).toHaveBeenCalledTimes(2);

  await screen.rerender(view("orchard", "loading"));
  const returning = screen.getByLabelText("Pomar em flor", { includeHiddenElements: true }).props;
  await act(() => orchard.onLoad());
  expect(onState).toHaveBeenCalledTimes(2);
  await act(() => returning.onLoad());
  expect(onState.mock.calls[2]).toEqual(["orchard", "ready"]);
  await screen.unmount();
  await act(() => returning.onError());
  expect(onState).toHaveBeenCalledTimes(3);
  expect(photos.map((item) => item.state)).toEqual(["ready", "ready"]);
});
