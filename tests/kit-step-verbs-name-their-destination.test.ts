// A step the person can see the end of moves with a word for the step ("Next",
// "Back", "Skip": the stepper's family, whose stages are drawn above it). A step that
// leads to a screen they cannot see says the name of that place, or the press is a
// guess. Both are read through the kit's own bundle, in both languages.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy } from "../src/core/derive";
import { kitExamples } from "../src/core/kitGallery";
import { presentation } from "./fakes/presentation";

function ok<T>(result: { ok: true; value: T } | { ok: false; issues: unknown }): T {
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value;
}

for (const [language, selection, order] of [
  ["en", "Review selection", "Review order"],
  ["pt", "Revisar a seleção", "Revisar o pedido"],
] as const) {
  const p = { ...presentation, copy: deriveCopy(language) };

  test(`${language}: the card and the cart say where their one verb leads`, () => {
    const card = ok(kitExamples(p, "product-card/options")).product;
    assert.equal(card?.product?.primary?.label, selection);
    const cart = ok(kitExamples(p, "cart/multiple-lines")).cart?.cart;
    assert.equal(cart?.checkout.label, order);
    const buy = ok(kitExamples(p, "buy-bar/default")).buy;
    assert.equal(
      buy.bar.actions.find((action) => action.id === "continue")?.label,
      order,
      "the buy bar offers the same step under a different word",
    );
  });

  test(`${language}: a step under way still names its destination`, () => {
    const busy = ok(kitExamples(p, "cart/checkout-busy")).cart?.cart;
    assert.equal(busy?.checkout.busy, true, "the specimen draws a checkout under way");
    assert.equal(busy?.checkout.label, order);
    // The refused quote keeps the same destination: what changed is that it cannot be
    // pressed yet, not where it would have gone.
    const expired = ok(kitExamples(p, "cart/quote-expired")).cart?.cart;
    assert.equal(expired?.checkout.enabled, false);
    assert.equal(expired?.checkout.label, order);
  });
}
