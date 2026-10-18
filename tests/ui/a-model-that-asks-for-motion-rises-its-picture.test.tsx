// The entrance of an empty screen's picture is the model's to ask for, not the
// atom's to guess: a state derived on a device that asks for motion rises once,
// for 300 ms, when the state view draws it, and a state derived on a device that
// asks for none is drawn still and starts nothing — through StateView, the one
// path a list's empty page reaches the picture by.
import { describe, expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Animated } from "react-native";
import { deriveState, type Motion, type StateModel } from "../../src/core/derive";
import { StateView } from "../../src/ui/molecules/StateView";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const emptyOn = (motion: Motion): StateModel => {
  const result = deriveState(
    { kind: "empty", illustration: "folder" },
    { ...presentation, motion },
  );
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

describe("an empty state's picture moves only when its model asks", () => {
  test("a model derived for motion rises its picture once, for 300 ms, on the native driver", async () => {
    const handle = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    const timing = jest.spyOn(Animated, "timing").mockReturnValue(handle as never);
    try {
      const model = emptyOn("normal");
      expect(model.motion).toBe("normal");
      await render(
        <ThemeProvider mode="light">
          <StateView model={model} onAction={() => undefined} />
        </ThemeProvider>,
      );
      expect(timing).toHaveBeenCalledTimes(1);
      expect(timing.mock.calls[0]?.[1]).toMatchObject({ duration: 300, useNativeDriver: true });
      expect(handle.start).toHaveBeenCalledTimes(1);
      await screen.unmount();
    } finally {
      timing.mockRestore();
    }
  });

  test("a model derived for reduced motion draws its picture still and starts nothing", async () => {
    const timing = jest.spyOn(Animated, "timing");
    try {
      await render(
        <ThemeProvider mode="dark">
          <StateView model={emptyOn("reduced")} onAction={() => undefined} />
        </ThemeProvider>,
      );
      expect(timing).not.toHaveBeenCalled();
      await screen.unmount();
    } finally {
      timing.mockRestore();
    }
  });
});
