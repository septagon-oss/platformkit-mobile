import React from "react";
import { View } from "react-native";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  deriveCart,
  deriveCopy,
  deriveState,
  type CartInput,
  type Presentation,
} from "../../src/core/derive";
import { Cart } from "../../src/ui/organisms/Cart";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

test.each([
  { language: "en", mode: "light" },
  { language: "en", mode: "dark" },
  { language: "pt", mode: "light" },
  { language: "pt", mode: "dark" },
] as const)(
  "$language/$mode cart loses denied content and cannot submit an expired or busy quote",
  async ({ language, mode }) => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const currency = { code: "EUR", fractionDigits: 2 };
    const input: CartInput = {
      content: {
        phase: "ready",
        refresh: "idle",
        value: [
          {
            id: "line-paper",
            productId: "paper",
            title: "Paper print",
            unitPrice: { minor: "725", currency },
            quantity: { value: 2, min: 1, max: 5, step: 1, state: "ready", label: "Copies" },
            availability: "available",
          },
        ],
      },
      currency,
      adjustments: [],
      quote: {
        id: "quote-first",
        revision: "rev-7",
        expiresAt: "2026-07-18T09:00:01Z",
        total: { minor: "1450", currency },
      },
      checkout: { id: "checkout", label: "Checkout", state: "ready", tone: "primary" },
    };
    const onCheckout = jest.fn(),
      onQuantity = jest.fn(),
      onRemove = jest.fn(),
      onOpen = jest.fn(),
      onRefresh = jest.fn();
    const view = (value: CartInput, formatting: Presentation = p) => {
      const model = deriveCart(value, formatting);
      if (!model.ok) throw new Error(JSON.stringify(model.issues));
      return (
        <ThemeProvider mode={mode}>
          <View testID="review-cart">
            <Cart
              model={model.value}
              onCheckout={onCheckout}
              onQuantity={onQuantity}
              onRemove={onRemove}
              onOpen={onOpen}
              onRefresh={onRefresh}
            />
          </View>
        </ThemeProvider>
      );
    };
    await render(view(input));
    await fireEvent.press(screen.getByRole("button", { name: "Checkout" }));
    expect(onCheckout.mock.calls).toEqual([[{ quoteId: "quote-first", revision: "rev-7" }]]);
    onCheckout.mockClear();

    for (const node of [
      view(input, { ...p, now: input.quote!.expiresAt }),
      view({ ...input, checkout: { ...input.checkout, state: "busy" } }),
    ]) {
      await screen.rerender(node);
      expect(screen.getByText("Paper print")).toBeOnTheScreen();
      const button = screen.getByRole("button", { name: "Checkout" });
      expect(button).toBeDisabled();
      await fireEvent.press(button);
      await fireEvent(button, "accessibilityAction", { nativeEvent: { actionName: "activate" } });
      expect(onCheckout).not.toHaveBeenCalled();
    }
    for (const code of ["forbidden", "not-found"] as const) {
      const state = deriveState(
        {
          kind: "error",
          issue: { code, path: "cart", recovery: "immutable", message: p.copy.kit.unavailable },
        },
        p,
      );
      if (!state.ok) throw new Error(JSON.stringify(state.issues));
      await screen.rerender(view({ ...input, content: { phase: "error", state: state.value } }));
      // The outer container establishes reachability without depending on refusal output.
      expect(screen.getByTestId("review-cart")).toBeOnTheScreen();
      expect(screen.queryByText("Paper print", { includeHiddenElements: true })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Checkout", includeHiddenElements: true }),
      ).toBeNull();
      expect(
        screen.queryByRole("adjustable", { name: "Copies", includeHiddenElements: true }),
      ).toBeNull();
      expect(onCheckout).not.toHaveBeenCalled();
      expect(onQuantity).not.toHaveBeenCalled();
      expect(onRemove).not.toHaveBeenCalled();
      expect(onOpen).not.toHaveBeenCalled();
      expect(onRefresh).not.toHaveBeenCalled();
    }
    await screen.rerender(
      view({ ...input, quote: { ...input.quote!, id: "quote-restored", revision: "rev-8" } }),
    );
    expect(onCheckout).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Checkout" }));
    expect(onCheckout.mock.calls).toEqual([[{ quoteId: "quote-restored", revision: "rev-8" }]]);
  },
);
