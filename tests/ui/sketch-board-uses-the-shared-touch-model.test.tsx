// Synthetic responder events exercise the same normalized stroke decisions the board uses.
import { expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { PanResponder } from "react-native";
import { SketchBoard } from "../../src/ui/molecules/SketchBoard";
import { ThemeProvider } from "../../src/ui/theme";
import type { SketchPoint } from "../../src/core/form";

const mockResponder = { current: undefined as Record<string, unknown> | undefined };

function captureResponder() {
  jest.spyOn(PanResponder, "create").mockImplementation(((handlers: Record<string, unknown>) => {
    mockResponder.current = handlers;
    return { panHandlers: handlers };
  }) as typeof PanResponder.create);
}

const event = (x: number, y: number, timestamp: number) => ({
  nativeEvent: { locationX: x, locationY: y, timestamp },
});

test("synthetic responder touches draw and commit the normalized stroke", async () => {
  captureResponder();
  const onChange = jest.fn();
  await render(
    <ThemeProvider mode="light">
      <SketchBoard
        value={[]}
        editable
        accessibilityLabel="Drawing"
        undoLabel="Undo"
        clearLabel="Clear"
        testID="sketch"
        onChange={onChange}
      />
    </ThemeProvider>,
  );
  const surface = screen.getByTestId("sketch");
  await act(async () => {
    surface.props.onLayout({ nativeEvent: { layout: { width: 200, height: 100, x: 0, y: 0 } } });
  });
  const handlers = mockResponder.current!;
  const grant = handlers.onPanResponderGrant as (event: unknown) => void;
  const move = handlers.onPanResponderMove as (event: unknown) => void;
  const release = handlers.onPanResponderRelease as () => void;
  await act(async () => {
    grant(event(50, 0, 100));
    move(event(150, 100, 112));
    release();
  });
  expect(onChange).toHaveBeenCalledWith([
    [
      [0, 0, 0],
      [1000, 1000, 12],
    ] satisfies readonly SketchPoint[],
  ]);
  await fireEvent.press(screen.getByRole("button", { name: "Undo" }));
  expect(onChange).toHaveBeenLastCalledWith([]);
});

test("read-only sketch has no drawing or edit actions", async () => {
  captureResponder();
  await render(
    <ThemeProvider mode="light">
      <SketchBoard
        value={[[[12, 15, 0]]]}
        editable={false}
        accessibilityLabel="Stored drawing"
        undoLabel="Undo"
        clearLabel="Clear"
        testID="stored-sketch"
      />
    </ThemeProvider>,
  );
  expect(screen.getByTestId("stored-sketch")).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
});
