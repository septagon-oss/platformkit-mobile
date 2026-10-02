// A state view shows the phase it is handed: failed, empty and pending reads render distinct bodies
// whose retries are the caller's own intents, a success keeps two independent actions, reduced
// motion never starts or continues a pulse, and a gallery consumer's palette, fonts and copy reach
// only its own screens — never another provider rendered beside them.
import { describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Animated } from "react-native";
import {
  deriveCopy,
  deriveState,
  stateExamples,
  type Action,
  type StateInput,
} from "../../src/core/derive";
import { mix } from "../../src/core/color";
import { Skeleton } from "../../src/ui/atoms/Skeleton";
import { Gallery } from "../../src/ui/gallery";
import { StateView } from "../../src/ui/molecules/StateView";
import { ThemeProvider, themeFor } from "../../src/ui/theme";
import { palette } from "../../src/ui/tokens";
import { presentation } from "../fakes/presentation";

function model(input: StateInput) {
  const result = deriveState(input, presentation);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

describe("StateView", () => {
  test("failed, empty and pending reads render distinct states; retries are caller intents", async () => {
    const action = jest.fn();
    const view = (input: StateInput) => <StateView model={model(input)} onAction={action} />;
    await render(view({ kind: "loading", skeleton: "rows" }));
    expect(screen.getByRole("progressbar", { name: "Loading" })).toBeBusy();
    await screen.rerender(
      view({
        kind: "error",
        issue: {
          code: "read-failed",
          recovery: "correctable",
          path: "records",
          message: "Connection lost.",
        },
        action: {
          intent: "retry-read",
          control: { id: "read", label: "Read again", state: "ready", tone: "primary" },
        },
      }),
    );
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByRole("alert")).toHaveProp("accessibilityLiveRegion", "assertive");
    expect(screen.queryByText("Nothing here yet")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Read again" }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith("read");
    expect(screen.queryByText("Done")).toBeNull();
    await screen.rerender(view({ kind: "empty" }));
    expect(screen.getByText("Nothing here yet")).toBeOnTheScreen();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test.each(["busy", "disabled"] as const)(
    "%s action rejects touch and assistive activation and retains its label",
    async (state) => {
      const action = jest.fn();
      await render(
        <StateView
          model={model({
            kind: "empty",
            action: {
              intent: "next",
              control: {
                id: "new/item",
                label: "Add a record",
                state,
                tone: "primary",
                reason: "Reconnect first.",
              },
            },
          })}
          onAction={action}
          testID="empty"
        />,
      );
      const button = screen.getByRole("button", { name: "Add a record" });
      expect(button).toBeDisabled();
      expect(screen.getByText("Reconnect first.")).toBeOnTheScreen();
      expect(screen.getByTestId("empty-action-new%2Fitem")).toBeOnTheScreen();
      await fireEvent.press(button);
      await fireEvent(button, "accessibilityAction", { nativeEvent: { actionName: "activate" } });
      expect(action).not.toHaveBeenCalled();
      if (state === "busy") expect(button).toBeBusy();
    },
  );

  test("success persists and exposes two independent caller-owned actions", async () => {
    const action = jest.fn();
    const result = model({
      kind: "success",
      action: {
        intent: "next",
        control: { id: "open", label: "Open record", state: "ready", tone: "primary" },
      },
      secondary: {
        intent: "dismiss",
        control: { id: "close", label: "Close", state: "ready", tone: "plain" },
      },
    });
    await render(<StateView model={result} onAction={action} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("text", { name: "Done. Your change was saved." })).toHaveProp(
      "accessibilityLiveRegion",
      "polite",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(action).toHaveBeenLastCalledWith("close");
    expect(screen.getByText("Your change was saved.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Open record" }));
    expect(action.mock.calls).toEqual([["close"], ["open"]]);
  });

  test.each(["light", "dark"] as const)(
    "focus, hover and scalable text use the %s theme",
    async (mode) => {
      await render(
        <ThemeProvider mode={mode}>
          <StateView
            model={model({
              kind: "empty",
              action: {
                intent: "next",
                control: {
                  id: "open",
                  label: "Continue with a longer explanation",
                  state: "ready",
                  tone: "secondary",
                },
              },
            })}
            onAction={() => undefined}
          />
        </ThemeProvider>,
      );
      const button = screen.getByRole("button", { name: "Continue with a longer explanation" });
      await fireEvent(button, "focus");
      expect(button).toHaveStyle({ borderColor: palette[mode].focus });
      await fireEvent(button, "hoverIn");
      // A hover is the derived role, measured from the palette it sits on: the
      // theme owns the mix, so the test asks the theme's own rule for the number.
      expect(button).toHaveStyle({
        backgroundColor: mix(palette[mode].surfacePrimary, palette[mode].accentDefault, 0.06),
      });
      await fireEvent(button, "hoverOut");
      await fireEvent(button, "blur");
      // The resting edge is the theme's outline role — the line that says a
      // control can be used, measured against the surface it is drawn on.
      expect(button).toHaveStyle({ borderColor: themeFor(mode).state.outline });
      expect(screen.getByText("Continue with a longer explanation")).toHaveProp(
        "maxFontSizeMultiplier",
        0,
      );
      expect(screen.getByText("Nothing here yet")).toHaveProp("maxFontSizeMultiplier", 0);
    },
  );

  test("reduced motion never starts a pulse and stops an already running pulse", async () => {
    const start = jest.fn();
    const stop = jest.fn();
    const loop = jest.spyOn(Animated, "loop").mockReturnValue({ start, stop, reset: jest.fn() });
    try {
      await render(<Skeleton label="A carregar" motion="reduced" />);
      expect(loop).not.toHaveBeenCalled();
      await screen.rerender(<Skeleton label="A carregar" motion="normal" />);
      expect(start).toHaveBeenCalledTimes(1);
      await screen.rerender(<Skeleton label="A carregar" motion="reduced" />);
      expect(stop).toHaveBeenCalledTimes(1);
      expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    } finally {
      loop.mockRestore();
    }
  });
});

for (const language of ["en", "pt"] as const)
  for (const mode of ["light", "dark"] as const) {
    test(`gallery renders all rich-state cases: ${language}, ${mode}`, async () => {
      const p = { ...presentation, copy: deriveCopy(language) };
      const examples = stateExamples(p);
      if (!examples.ok) throw new Error("gallery did not derive");
      for (const example of examples.value) {
        await render(<Gallery presentation={p} initialMode={mode} initialCaseId={example.id} />);
        const view = screen.getByTestId(
          example.renderer === "spinner" ? "gallery-spinner" : "gallery-state",
        );
        expect(view).toBeOnTheScreen();
        if (example.model.component === "skeleton")
          expect(screen.getByRole("progressbar", { name: p.copy.state.loading })).toBeBusy();
        else expect(screen.getByText(example.model.title)).toBeOnTheScreen();
        await screen.unmount();
      }
    });
  }

test.each([{ locale: "not_a_locale" }, { locale: "xx-ZZ" }, { timeZone: "Unknown/TimeZone" }])(
  "the default gallery presents a translated refusal for unsupported formatting %p",
  async (format) => {
    const p = { ...presentation, copy: deriveCopy("pt"), ...format };
    const validation = deriveState({ kind: "empty" }, p);
    expect(validation.ok).toBe(false);
    // The default primitive samples must not bypass the very same refusal and
    // either crash in Intl or silently render device-default formatting.
    await render(<Gallery presentation={p} />);
    expect(screen.getByRole("alert")).toHaveTextContent(p.copy.issue.unsupported);
  },
);

test.each(["light", "dark"] as const)(
  "%s recovery stays blocked until current props make it ready",
  async (mode) => {
    const onAction = jest.fn();
    const p = { ...presentation, copy: deriveCopy("pt"), locale: "pt-PT" };
    const view = (state: Action["state"]) => {
      const result = deriveState(
        {
          kind: "error",
          issue: {
            code: "write-unknown",
            recovery: "correctable",
            path: "submit",
            message: "O pedido não respondeu.",
          },
          action: {
            intent: "reconcile",
            control: {
              id: "result/ação",
              label: "Consultar o resultado",
              state,
              tone: "primary",
              ...(state === "disabled" ? { reason: "Aguarde pela ligação." } : {}),
            },
          },
        },
        p,
      );
      if (!result.ok) throw new Error(JSON.stringify(result.issues));
      return (
        <ThemeProvider mode={mode}>
          <StateView model={result.value} onAction={onAction} testID="reconcile-state" />
        </ThemeProvider>
      );
    };
    await render(view("busy"));
    for (const state of ["busy", "disabled"] as const) {
      await screen.rerender(view(state));
      const control = screen.getByRole("button", { name: "Consultar o resultado" });
      expect(control).toBeDisabled();
      await fireEvent.press(control);
      await fireEvent(control, "accessibilityAction", { nativeEvent: { actionName: "activate" } });
      expect(onAction).not.toHaveBeenCalled();
      expect(screen.queryByText("A alteração foi guardada.")).toBeNull();
      expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
    }
    await screen.rerender(view("ready"));
    const control = screen.getByRole("button", { name: "Consultar o resultado" });
    expect(control).toBeEnabled();
    await fireEvent(control, "accessibilityAction", { nativeEvent: { actionName: "activate" } });
    expect(onAction.mock.calls).toEqual([["result/ação"]]);
    expect(screen.getByRole("alert")).toHaveProp("accessibilityLanguage", "pt");
    expect(screen.queryByText("A alteração foi guardada.")).toBeNull();
  },
);

test("gallery consumers supply their palette, fonts and copy without changing another provider", async () => {
  const colors = {
    light: { ...palette.light, statusWarningBg: palette.light.surfaceMuted },
    dark: { ...palette.dark, statusWarningBg: palette.dark.surfaceMuted },
  };
  await render(
    <>
      <Gallery
        presentation={{ ...presentation, copy: deriveCopy("pt") }}
        palette={colors}
        fonts={{ display: "Georgia", body: "Courier", mono: "Menlo" }}
        initialCaseId="notice/offline"
      />
      <ThemeProvider mode="light">
        <StateView
          model={model({ kind: "offline" })}
          onAction={() => undefined}
          testID="independent"
        />
      </ThemeProvider>
    </>,
  );
  expect(screen.getByTestId("gallery-state")).toHaveStyle({
    backgroundColor: colors.light.statusWarningBg,
  });
  expect(screen.getByText("Está sem ligação")).toHaveStyle({ fontFamily: "Courier" });
  expect(screen.getByTestId("independent")).toHaveStyle({
    backgroundColor: palette.light.statusWarningBg,
  });
  expect(screen.getByText("You are offline")).toBeOnTheScreen();
  await act(async () => undefined);
});
