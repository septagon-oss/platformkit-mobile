// A figure's native load completion removes its placeholder. A failed byte read
// offers retry, and the retry makes a fresh request whose successful load restores the figure.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import type { Entry } from "../../src/core/catalog";
import { RichTextBody } from "../../src/screens/RichTextBody";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-image", () => ({ Image: "NativeImageDouble" }));
jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));

beforeEach(() => {
  const api = fakeApi();
  api.get.mockResolvedValue({ width: 2400, height: 1600, sha256: "same-frame" });
  const files: Entry = { ...note, module: "file", entity: "files", path: "/api/v1/file/files" };
  shell.value = shellValue(api, { entry: () => files });
});

test("a failed figure can retry and replace its loading placeholder with the recovered image", async () => {
  const source = '![A bridge](pk-file:22222222-2222-4222-8222-222222222222 "South span")';
  await render(
    <ThemeProvider mode="light">
      <RichTextBody
        presentation={presentation}
        source={source}
        testID="body"
        fallback={<Text>{source}</Text>}
      />
    </ThemeProvider>,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("A bridge", { includeHiddenElements: true })).toBeTruthy(),
  );
  const first = screen.getByLabelText("A bridge", { includeHiddenElements: true }).props;
  await act(() => first.onLoad());
  expect(screen.queryByTestId("body-figure-loading-fig-0")).toBeNull();
  const loaded = screen.getByLabelText("A bridge", { includeHiddenElements: true }).props;
  await act(() => loaded.onError());
  expect(screen.getByText("Image unavailable")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: presentation.copy.kit.retryImage }));
  await waitFor(() =>
    expect(screen.getByLabelText("A bridge", { includeHiddenElements: true })).toBeTruthy(),
  );
  const retried = screen.getByLabelText("A bridge", { includeHiddenElements: true }).props;
  expect(retried.recyclingKey).not.toBe(first.recyclingKey);
  await act(() => retried.onLoad());
  expect(screen.queryByTestId("body-figure-loading-fig-0")).toBeNull();
  expect(screen.queryByText("Image unavailable")).toBeNull();
  expect(screen.getByText("South span")).toBeOnTheScreen();
});
