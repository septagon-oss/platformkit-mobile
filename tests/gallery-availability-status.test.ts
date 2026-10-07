import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy, kitExamples } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

for (const language of ["en", "pt"] as const) {
  test(`${language}: a sold-out gallery product never advertises itself as available`, () => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const result = kitExamples(p, "product-card/sold-out");
    assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
    const product = result.value.product.product;
    assert.ok(product, "the sold-out specimen still displays its product");
    assert.equal(product.availability, "sold-out");
    assert.equal(product.primary?.enabled, false);
    assert.notEqual(product.status?.label, p.copy.kit.available, language);
  });
}
