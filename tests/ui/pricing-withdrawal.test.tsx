import React from "react";
import { View } from "react-native";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { deriveCopy, derivePricing, deriveState, type PricingInput } from "../../src/core/derive";
import { PlanComparison } from "../../src/ui/organisms/PlanComparison";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

test.each([
  { language: "en", mode: "light" },
  { language: "en", mode: "dark" },
  { language: "pt", mode: "light" },
  { language: "pt", mode: "dark" },
] as const)(
  "$language/$mode plan recovery needs an explicit action and never retains denied values",
  async ({ language, mode }) => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const labels =
      language === "en"
        ? { plan: "Studio", enrol: "Enrol", history: "History", value: "Saved drafts: 17" }
        : { plan: "Estúdio", enrol: "Aderir", history: "Histórico", value: "Rascunhos: 17" };
    const input: PricingInput = {
      content: {
        phase: "ready",
        refresh: "idle",
        value: [
          {
            id: "studio",
            title: labels.plan,
            offers: [
              {
                periodId: "month",
                price: {
                  kind: "price",
                  amount: { minor: "2197", currency: { code: "EUR", fractionDigits: 2 } },
                },
                action: { id: "enrol", label: labels.enrol, state: "ready", tone: "primary" },
              },
            ],
            features: { history: { kind: "text", text: labels.value } },
          },
        ],
      },
      periods: [
        { id: "month", label: "Monthly" },
        { id: "year", label: "Yearly" },
      ],
      features: [{ id: "history", label: labels.history }],
      selectedPeriodId: "month",
      selectedPlanId: "studio",
    };
    const callbacks = {
      onAction: jest.fn(),
      onSelect: jest.fn(),
      onPeriod: jest.fn(),
      onRetry: jest.fn(),
    };
    const view = (value: PricingInput) => {
      const model = derivePricing(value, p);
      if (!model.ok) throw new Error(JSON.stringify(model.issues));
      return (
        <ThemeProvider mode={mode}>
          <View testID="review-pricing">
            <PlanComparison model={model.value.comparison} {...callbacks} />
          </View>
        </ThemeProvider>
      );
    };
    await render(view(input));
    expect(screen.getByText(labels.value)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: labels.enrol }));
    expect(callbacks.onAction.mock.calls).toEqual([
      [{ planId: "studio", periodId: "month", actionId: "enrol" }],
    ]);
    callbacks.onAction.mockClear();
    if (input.content.phase !== "ready") throw new Error("Expected the ready test fixture");

    await screen.rerender(view({ ...input, content: { ...input.content, refresh: "loading" } }));
    const pending = screen.getByRole("button", { name: labels.enrol });
    expect(pending).toBeDisabled();
    await fireEvent.press(pending);
    await fireEvent(pending, "accessibilityAction", { nativeEvent: { actionName: "activate" } });
    expect(callbacks.onAction).not.toHaveBeenCalled();

    await screen.rerender(view({ ...input, selectedPeriodId: "year" }));
    expect(screen.getByTestId("review-pricing")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: labels.enrol })).toBeNull();
    const unavailable = screen.getByRole("button", {
      name: `${p.copy.kit.select}: ${labels.plan}`,
    });
    expect(unavailable).toBeDisabled();
    await fireEvent.press(unavailable);
    await fireEvent(unavailable, "accessibilityAction", {
      nativeEvent: { actionName: "activate" },
    });
    expect(callbacks.onSelect).not.toHaveBeenCalled();

    for (const code of ["forbidden", "not-found"] as const) {
      const state = deriveState(
        {
          kind: "error",
          issue: { code, path: "plans", recovery: "immutable", message: p.copy.kit.unavailable },
        },
        p,
      );
      if (!state.ok) throw new Error(JSON.stringify(state.issues));
      await screen.rerender(view({ ...input, content: { phase: "error", state: state.value } }));
      // Reach the mounted surface independently of the refusal's wording or old content.
      expect(screen.getByTestId("review-pricing")).toBeOnTheScreen();
      expect(screen.queryByText(labels.plan, { includeHiddenElements: true })).toBeNull();
      expect(screen.queryByText(labels.value, { includeHiddenElements: true })).toBeNull();
      expect(
        screen.queryByRole("button", { name: labels.enrol, includeHiddenElements: true }),
      ).toBeNull();
      for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
    }
    await screen.rerender(view(input));
    for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
    await fireEvent(screen.getByRole("button", { name: labels.enrol }), "accessibilityAction", {
      nativeEvent: { actionName: "activate" },
    });
    expect(callbacks.onAction.mock.calls).toEqual([
      [{ planId: "studio", periodId: "month", actionId: "enrol" }],
    ]);
  },
);
