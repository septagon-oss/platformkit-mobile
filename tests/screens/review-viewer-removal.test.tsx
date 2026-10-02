import React from "react";
import { expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { deriveCopy, deriveViewer, type MediaItem } from "../../src/core/derive";
import { NativeImage } from "../../src/screens/NativeImage";
import { PhotoViewer } from "../../src/ui/organisms/PhotoViewer";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

// Reuse the native-image suite's SDK seam; core selection and adapter lifetime stay real.
jest.mock("expo-image", () => ({ Image: "NativeImageDouble" }));

test.each([
  { language: "en", mode: "light" },
  { language: "en", mode: "dark" },
  { language: "pt", mode: "light" },
  { language: "pt", mode: "dark" },
] as const)(
  "T0180: $language/$mode viewer removes a revoked selection without substituting another image",
  async ({ language, mode }) => {
    const onState = jest.fn();
    const onSelect = jest.fn();
    const onRetry = jest.fn();
    const onClose = jest.fn();
    const p = { ...presentation, copy: deriveCopy(language) };
    const selected: MediaItem = {
      id: "cedar",
      width: 720,
      height: 1080,
      description: "Cedar beside a stream",
      caption: "Selected image caption",
      decorative: false,
      state: "ready",
    };
    const remaining: MediaItem = {
      ...selected,
      id: "shore",
      description: "Shore at low tide",
      caption: "Another image caption",
    };
    const view = (items: readonly MediaItem[], scope: string) => {
      const result = deriveViewer(
        {
          open: true,
          selectedId: selected.id,
          content: { phase: "ready", refresh: "idle", value: items },
          page: { more: false, loading: false },
        },
        p,
      );
      if (!result.ok) throw new Error(JSON.stringify(result.issues));
      return (
        <ThemeProvider mode={mode}>
          <PhotoViewer
            model={result.value}
            renderImage={(model) => (
              <NativeImage
                model={model}
                resource={{
                  id: model.id,
                  scope,
                  version: "revision-9",
                  uri: `https://images.example.test/${model.id}`,
                }}
                onState={onState}
              />
            )}
            renderZoom={({ children }) => <>{children}</>}
            onSelect={onSelect}
            onRetry={onRetry}
            onClose={onClose}
          />
        </ThemeProvider>
      );
    };

    await render(view([selected, remaining], "first-scope"));
    const abandoned = screen.getByLabelText(selected.description).props;
    await act(() => abandoned.onLoad());
    expect(onState.mock.calls).toEqual([[selected.id, "ready"]]);
    expect(screen.getByText(selected.caption!)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: p.copy.kit.next })).toBeEnabled();

    // Reach the refusal through the still-open surface, independently of its notice.
    await screen.rerender(view([remaining], "first-scope"));
    expect(screen.getByRole("button", { name: p.copy.kit.close })).toBeEnabled();
    expect(screen.getByText(p.copy.kit.unavailable)).toBeOnTheScreen();
    for (const item of [selected, remaining]) {
      expect(screen.queryByLabelText(item.description, { includeHiddenElements: true })).toBeNull();
      expect(screen.queryByText(item.caption!, { includeHiddenElements: true })).toBeNull();
    }
    for (const name of [p.copy.kit.previous, p.copy.kit.next]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      await fireEvent.press(button);
    }
    expect(screen.queryByRole("button", { name: p.copy.kit.retryImage })).toBeNull();
    await act(() => {
      abandoned.onLoadStart();
      abandoned.onLoad();
      abandoned.onError();
    });
    expect(onState.mock.calls).toEqual([[selected.id, "ready"]]);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: p.copy.kit.close }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // A new authorized read may return the same ID; only its new loader can report.
    await screen.rerender(view([selected, remaining], "second-scope"));
    const active = screen.getByLabelText(selected.description).props;
    expect(active.recyclingKey).not.toBe(abandoned.recyclingKey);
    await act(() => {
      abandoned.onLoad();
      active.onLoad();
    });
    expect(onState.mock.calls).toEqual([
      [selected.id, "ready"],
      [selected.id, "ready"],
    ]);
    expect(screen.queryByText(p.copy.kit.unavailable)).toBeNull();
    expect(screen.getByText(selected.caption!)).toBeOnTheScreen();
    await screen.unmount();
    await act(() => active.onError());
    expect(onState).toHaveBeenCalledTimes(2);
  },
);
