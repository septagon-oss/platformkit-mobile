// A cart total is money a renderer shows and a checkout charges: it has to carry the cart's own
// currency, never a default, and computing it must not edit the lines the caller still holds.
import assert from "node:assert/strict";
import test from "node:test";
import { cartTotals } from "../src/core/derive";

test("a cart total carries the cart's currency and leaves the caller's lines untouched", () => {
  const currency = { code: "BRL", fractionDigits: 2 };
  const input = {
    currency,
    lines: [
      { id: "tea", unitPrice: { minor: "275", currency }, quantity: 4 },
      { id: "cup", unitPrice: { minor: "1890", currency }, quantity: 1 },
    ],
    adjustments: [{ id: "voucher", label: "Voucher", amount: { minor: "-150", currency } }],
  };
  const before = JSON.stringify(input);
  const result = cartTotals(input);
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  assert.equal(result.value.subtotal.minor, "2990");
  assert.equal(result.value.total.minor, "2840");
  assert.deepEqual(result.value.subtotal.currency, currency);
  assert.deepEqual(result.value.total.currency, currency);
  assert.equal(JSON.stringify(input), before);
});
