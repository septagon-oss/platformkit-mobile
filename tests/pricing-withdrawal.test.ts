// Offers and plan values are facts the caller was allowed to read. When they are withdrawn the
// table drops them and disables the action rather than substituting another plan or leaving a
// live button over a value nobody can see. A feature key the plan never specified refuses the
// whole model and leaves the input untouched.
import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCopy,
  derivePricing,
  deriveState,
  type Plan,
  type PricingInput,
  type Result,
} from "../src/core/derive";
import { presentation } from "./fakes/presentation";

function ok<T>(result: Result<T>): T {
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value;
}

for (const language of ["en", "pt"] as const) {
  test(`${language} pricing withdrawal drops offers and feature values without substituting a plan`, () => {
    const p = {
      ...presentation,
      copy: deriveCopy(language),
      locale: language === "en" ? "en-GB" : "pt-PT",
    };
    const plans: Plan[] = [
      {
        id: "studio",
        title: "Studio",
        offers: [
          {
            periodId: "month",
            price: {
              kind: "price",
              amount: { minor: "1873", currency: { code: "EUR", fractionDigits: 2 } },
            },
            action: { id: "enrol", label: "Enrol", state: "ready", tone: "primary" },
          },
        ],
        features: { history: { kind: "text", text: "History for account 17" } },
      },
    ];
    const input: PricingInput = {
      content: { phase: "ready", refresh: "idle", value: plans },
      periods: [
        { id: "month", label: "Monthly" },
        { id: "year", label: "Yearly" },
      ],
      selectedPeriodId: "month",
      selectedPlanId: "studio",
      features: [{ id: "history", label: "History" }],
    };
    const before = JSON.stringify(input);
    const original = ok(derivePricing(input, p));
    assert.equal(original.tiers.plans[0]!.offer?.action?.enabled, true);
    assert.equal(original.comparison.features[0]!.values[0]!.text, "History for account 17");
    assert.match(
      original.tiers.plans[0]!.offer!.price!.text,
      language === "en" ? /18\.73/ : /18,73/,
    );

    const missing = ok(derivePricing({ ...input, selectedPeriodId: "year" }, p));
    for (const model of [missing.tiers, missing.comparison]) {
      assert.equal(model.plans[0]!.offer, undefined);
      assert.equal(model.plans[0]!.enabled, false);
      assert.equal(model.selectionIssue?.code, "unavailable");
      assert.equal(model.selectionIssue?.message, p.copy.kit.unavailable);
    }
    const refreshing = ok(
      derivePricing({ ...input, content: { phase: "ready", refresh: "loading", value: plans } }, p),
    );
    assert.equal(refreshing.tiers.plans[0]!.offer?.action?.enabled, false);
    assert.equal(refreshing.comparison.plans[0]!.offer?.action?.enabled, false);

    for (const code of ["forbidden", "not-found"] as const) {
      const state = ok(
        deriveState(
          {
            kind: "error",
            issue: { code, path: "plans", recovery: "immutable", message: p.copy.kit.unavailable },
          },
          p,
        ),
      );
      const denied = ok(derivePricing({ ...input, content: { phase: "error", state } }, p));
      for (const model of [denied.tiers, denied.comparison]) {
        assert.deepEqual(model.plans, []);
        assert.equal(model.writable, false);
        assert.equal(model.state?.language, language);
        assert.deepEqual(model.state?.actions, []);
        assert.equal(model.selectionIssue?.code, "unavailable");
        assert.equal(JSON.stringify(model).includes("History for account 17"), false);
      }
      assert.deepEqual(denied.comparison.features[0]!.values, []);
    }

    const malformed = derivePricing(
      {
        ...input,
        content: {
          phase: "ready",
          refresh: "idle",
          value: [{ ...plans[0]!, features: { unknown: { kind: "included" } } }],
        },
      },
      p,
    );
    assert.equal(malformed.ok, false);
    assert.equal("value" in malformed, false);
    if (!malformed.ok) {
      assert.equal(malformed.issues[0]!.code, "invalid-input");
      assert.equal(malformed.issues[0]!.recovery, "immutable");
      assert.equal(malformed.issues[0]!.message, p.copy.issue.invalid);
    }
    assert.deepEqual(ok(derivePricing(input, p)), original);
    assert.equal(JSON.stringify(input), before);
    assert.equal(Object.isFrozen(plans[0]!.features), false);
    assert.equal(Object.isFrozen(original.comparison.features[0]!.values), true);
    plans[0] = { ...plans[0]!, title: "Changed draft" };
    assert.equal(original.tiers.plans[0]!.title, "Studio");
    assert.equal(ok(derivePricing(input, p)).tiers.plans[0]!.title, "Changed draft");
  });
}
