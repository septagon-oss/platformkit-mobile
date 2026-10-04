import React from "react";
import { expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { deriveCopy, deriveState, deriveViewer, type MediaInput } from "../../src/core/derive";
import { NativeImage } from "../../src/screens/NativeImage";
import { PhotoViewer } from "../../src/ui/organisms/PhotoViewer";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

// Use the existing SDK seam; the denial, rendering and loader owners remain real.
jest.mock("expo-image", () => ({ Image: "NativeImageDouble" }));

test.each([
  { language: "en", mode: "light" },
  { language: "en", mode: "dark" },
  { language: "pt", mode: "light" },
  { language: "pt", mode: "dark" },
] as const)(
  "$language/$mode viewer denial abandons the loader even when identical media returns",
  async ({ language, mode }) => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const onState = jest.fn();
    const onSelect = jest.fn();
    const onRetry = jest.fn();
    const onClose = jest.fn();
    const item = {
      id: "lighthouse",
      width: 1600,
      height: 1000,
      description: "Lighthouse above the inlet",
      caption: "Caption from the authorized response",
      decorative: false,
      state: "ready" as const,
    };
    const authorized: MediaInput["content"] = {
      phase: "ready",
      refresh: "idle",
      value: [item],
    };
    const view = (content: MediaInput["content"]) => {
      const derived = deriveViewer(
        { open: true, selectedId: item.id, content, page: { more: true, loading: false } },
        p,
      );
      if (!derived.ok) throw new Error(JSON.stringify(derived.issues));
      return (
        <ThemeProvider mode={mode}>
          <PhotoViewer
            model={derived.value}
            renderImage={(model) => (
              <NativeImage
                model={model}
                resource={{
                  id: model.id,
                  scope: "unchanged-session",
                  version: "revision-4",
                  uri: "https://images.example.test/lighthouse",
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

    await render(view(authorized));
    const abandoned: { onLoadStart: () => void; onLoad: () => void; onError: () => void }[] = [];
    for (const code of ["forbidden", "not-found"] as const) {
      const loader = screen.getByLabelText(item.description).props;
      abandoned.push({
        onLoadStart: loader.onLoadStart,
        onLoad: loader.onLoad,
        onError: loader.onError,
      });
      await act(() => loader.onLoad());
      const completed = onState.mock.calls.length;
      const denied = deriveState(
        {
          kind: "error",
          issue: { code, path: "media", recovery: "immutable", message: p.copy.kit.unavailable },
        },
        p,
      );
      if (!denied.ok) throw new Error(JSON.stringify(denied.issues));
      await screen.rerender(view({ phase: "error", state: denied.value }));

      // The still-open Close control establishes reachability without relying on the notice.
      const close = screen.getByRole("button", { name: p.copy.kit.close });
      expect(close).toBeEnabled();
      expect(screen.queryByLabelText(item.description, { includeHiddenElements: true })).toBeNull();
      expect(screen.queryByText(item.caption, { includeHiddenElements: true })).toBeNull();
      expect(screen.getByText(p.copy.kit.unavailable)).toBeOnTheScreen();
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(screen.queryByRole("button", { name: p.copy.kit.retryImage })).toBeNull();
      for (const name of [p.copy.kit.previous, p.copy.kit.next]) {
        const control = screen.getByRole("button", { name });
        expect(control).toBeDisabled();
        await fireEvent.press(control);
      }
      await act(() => {
        for (const old of abandoned) {
          old.onLoadStart();
          old.onLoad();
          old.onError();
        }
      });
      expect(onState).toHaveBeenCalledTimes(completed);
      expect(onSelect).not.toHaveBeenCalled();
      expect(onRetry).not.toHaveBeenCalled();
      await fireEvent.press(close);

      // A later authorized response can return the exact same source, scope and version.
      await screen.rerender(view(authorized));
      const current = screen.getByLabelText(item.description).props;
      expect(screen.getByText(item.caption)).toBeOnTheScreen();
      expect(screen.queryByText(p.copy.kit.unavailable)).toBeNull();
      await act(() => {
        for (const old of abandoned) old.onError();
        current.onLoadStart();
        current.onLoad();
      });
      expect(onState.mock.calls.slice(completed)).toEqual([
        [item.id, "loading"],
        [item.id, "ready"],
      ]);
    }
    expect(onClose).toHaveBeenCalledTimes(2);
    const active = screen.getByLabelText(item.description).props;
    const completed = onState.mock.calls.length;
    await screen.unmount();
    await act(() => active.onError());
    expect(onState).toHaveBeenCalledTimes(completed);
    expect(item.state).toBe("ready");
  },
);
