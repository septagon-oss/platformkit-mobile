// A stepper that cannot move is a control drawn in the ink of a control that is
// out of reach. The kit demonstrates a step at its floor on the quantity specimens,
// which are about that state; on the pages that show a task in progress every half
// of every stepper has somewhere to go.
import assert from "node:assert/strict";
import test from "node:test";
import { kitExamples } from "../src/core/kitGallery";
import { presentation } from "./fakes/presentation";

function ok<T>(result: { ok: true; value: T } | { ok: false; issues: unknown }): T {
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value;
}

test("every line of the gallery's cart can step down as well as up", () => {
  const specimen = ok(kitExamples(presentation, "cart/multiple-lines")).cart;
  assert.ok(specimen, "the cart specimen derives a cart");
  const cart = specimen.cart;
  assert.ok(cart, "the cart specimen holds a cart to edit");
  assert.ok(cart.lines.length > 1, "the specimen draws more than one line");
  for (const line of cart.lines) {
    assert.notEqual(line.quantity.increase, undefined, `${line.id} cannot step up`);
    assert.notEqual(line.quantity.decrease, undefined, `${line.id} cannot step down`);
  }
  // The quote still vouches for what the lines hold: moving a quantity without
  // moving the figure the cart is charged would be refused by the cart itself.
  assert.ok(cart.target, "the cart offers a quote to check out");
});

test("a product card opens on a quantity a person would have chosen", () => {
  const product = ok(kitExamples(presentation, "product-card/options")).product;
  assert.ok(product?.product, "the card specimen draws a product");
  const quantity = product.product.quantity;
  assert.ok(quantity, "the card carries a quantity control");
  // Not at either end of its range, so both halves of the stepper are live, and
  // not at the top of a small range either, which is a limit rather than a choice.
  assert.ok(
    quantity.value > quantity.min && quantity.value < quantity.max,
    `quantity ${quantity.value} sits at an end of ${quantity.min}–${quantity.max}`,
  );
  assert.notEqual(quantity.decrease, undefined, "the card cannot step its quantity down");
  assert.notEqual(quantity.increase, undefined, "the card cannot step its quantity up");
});
