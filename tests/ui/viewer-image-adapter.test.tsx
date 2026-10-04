import React from "react";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { deriveViewer, type MediaItem, type Result } from "../../src/core/derive";
import { PhotoViewer } from "../../src/ui/organisms/PhotoViewer";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

function ok<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

const photo: MediaItem = {
  id: "harbor",
  width: 1200,
  height: 800,
  description: "Harbor at dawn",
  decorative: false,
  state: "ready",
};

function viewer(state: MediaItem["state"], onRetry: (id: string) => void) {
  const model = ok(
    deriveViewer(
      {
        content: { phase: "ready", value: [{ ...photo, state }], refresh: "idle" },
        selectedId: photo.id,
        open: true,
        page: { more: false, loading: false },
      },
      presentation,
    ),
  );
  return (
    <ThemeProvider mode="light">
      <PhotoViewer
        model={model}
        renderImage={(slot) => <Text testID={`image-${slot.id}`}>{slot.description}</Text>}
        renderZoom={({ children }) => <>{children}</>}
        onSelect={() => undefined}
        onClose={() => undefined}
        onRetry={onRetry}
      />
    </ThemeProvider>
  );
}

test("an open viewer keeps its selected image adapter mounted during loading", async () => {
  const retry = jest.fn();
  await render(viewer("ready", retry));
  expect(screen.getByTestId("image-harbor")).toBeOnTheScreen();
  await screen.rerender(viewer("loading", retry));
  // The native loader must stay mounted to complete and report the same image ID.
  expect(screen.getByTestId("image-harbor", { includeHiddenElements: true })).toBeOnTheScreen();
  expect(screen.getByRole("progressbar")).toBeOnTheScreen();
  expect(retry).not.toHaveBeenCalled();
});

test.each(["error", "unavailable"] as const)(
  "an open viewer offers recovery for its selected %s image",
  async (state) => {
    const retry = jest.fn();
    await render(viewer(state, retry));
    expect(screen.getByRole("button", { name: presentation.copy.kit.close })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: presentation.copy.kit.retryImage }));
    expect(retry.mock.calls).toEqual([["harbor"]]);
  },
);
