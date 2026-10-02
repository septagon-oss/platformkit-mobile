import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { deriveCopy, deriveState, type Action } from "../../src/core/derive";
import { Gallery } from "../../src/ui/gallery";
import { StateView } from "../../src/ui/molecules/StateView";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

test.each([{ locale: "not_a_locale" }, { locale: "xx-ZZ" }, { timeZone: "Unknown/TimeZone" }])(
  "T0180: the default gallery presents a translated refusal for unsupported formatting %p",
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
  "T0180: %s recovery stays blocked until current props make it ready",
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
          <StateView model={result.value} onAction={onAction} testID="review-state" />
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
