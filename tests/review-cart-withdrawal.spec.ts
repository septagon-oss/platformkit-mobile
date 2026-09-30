import assert from "node:assert/strict";
import test from "node:test";
import {
  cartTotals,
  deriveCart,
  deriveCopy,
  deriveState,
  type CartInput,
  type Result,
} from "../src/core/derive";
import { presentation } from "./fakes/presentation";

function ok<T>(result: Result<T>): T {
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value;
}

test("T0180: a withdrawn cart quote cannot retain checkout and a fresh quote restores only its own revision", () => {
  for (const language of ["en", "pt"] as const) {
    const p = { ...presentation, copy: deriveCopy(language) };
    const currency = { code: "EUR", fractionDigits: 2 };
    const line = {
      id: "line-copper",
      productId: "copper",
      title: "Copper print",
      unitPrice: { minor: "499", currency },
      quantity: { value: 3, min: 1, max: 8, step: 1, state: "ready" as const, label: "Copies" },
      availability: "available" as const,
    };
    const input: CartInput = {
      content: { phase: "ready", refresh: "idle", value: [line] },
      currency,
      adjustments: [
        { id: "shipping", label: "Shipping", amount: { minor: "79", currency } },
        { id: "discount", label: "Discount", amount: { minor: "-101", currency } },
      ],
      quote: {
        id: "quote-copper",
        revision: "rev-41",
        expiresAt: "2026-07-18T09:00:01Z",
        total: { minor: "1475", currency },
      },
      checkout: { id: "checkout", label: "Checkout", state: "ready", tone: "primary" },
    };
    const before = JSON.stringify(input);
    const totals = ok(
      cartTotals({
        currency,
        lines: [{ id: line.id, unitPrice: line.unitPrice, quantity: 3 }],
        adjustments: input.adjustments,
      }),
    );
    assert.equal(totals.subtotal.minor, "1497");
    assert.equal(totals.total.minor, "1475");
    const initial = ok(deriveCart(input, p));
    assert.equal(initial.cart?.checkout.enabled, true);
    assert.deepEqual(initial.cart?.target, { quoteId: "quote-copper", revision: "rev-41" });

    const expired = ok(deriveCart(input, { ...p, now: input.quote!.expiresAt }));
    const soldOut = ok(
      deriveCart(
        {
          ...input,
          content: {
            phase: "ready",
            refresh: "idle",
            value: [{ ...line, availability: "sold-out" }],
          },
        },
        p,
      ),
    );
    const refreshing = ok(
      deriveCart({ ...input, content: { phase: "ready", refresh: "loading", value: [line] } }, p),
    );
    assert.equal(expired.cart?.checkout.reason, p.copy.kit.quoteExpired);
    for (const refused of [expired, soldOut, refreshing]) {
      assert.ok(refused.cart, "the supplied readable cart remains visible");
      assert.equal(refused.cart.checkout.enabled, false);
      assert.ok(refused.cart.checkout.reason?.trim(), "an unavailable checkout explains why");
      assert.equal(refused.cart.target, undefined);
    }

    const mismatched = deriveCart(
      {
        ...input,
        content: {
          phase: "ready",
          refresh: "idle",
          value: [{ ...line, quantity: { ...line.quantity, value: 4 } }],
        },
      },
      p,
    );
    assert.equal(mismatched.ok, false);
    assert.equal("value" in mismatched, false);
    if (!mismatched.ok) {
      assert.equal(mismatched.issues[0]?.path, "quote.total");
      assert.equal(mismatched.issues[0]?.message, p.copy.issue.invalid);
    }

    for (const code of ["forbidden", "not-found"] as const) {
      const state = ok(
        deriveState(
          {
            kind: "error",
            issue: { code, path: "cart", recovery: "immutable", message: p.copy.kit.unavailable },
          },
          p,
        ),
      );
      const denied = ok(deriveCart({ ...input, content: { phase: "error", state } }, p));
      assert.equal(denied.cart, undefined);
      assert.deepEqual(denied.state, state);
    }
    const restored = ok(
      deriveCart(
        { ...input, quote: { ...input.quote!, id: "quote-restored", revision: "rev-42" } },
        p,
      ),
    );
    assert.equal(restored.cart?.checkout.enabled, true);
    assert.deepEqual(restored.cart?.target, { quoteId: "quote-restored", revision: "rev-42" });
    assert.equal(JSON.stringify(input), before);
    assert.equal(Object.isFrozen(line), false);
    line.title = "Caller draft changed";
    assert.equal(initial.cart?.lines[0]?.title, "Copper print");
    assert.ok(Object.isFrozen(restored.cart?.target));
  }
});
