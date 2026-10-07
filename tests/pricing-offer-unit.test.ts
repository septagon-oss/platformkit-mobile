// An amount a person chooses a plan on is a promise about a schedule: EUR 12.99
// paid every month and EUR 12.99 paid once a year are the same four figures and
// two different commitments. The unit belongs to the period, the figure belongs
// to the period, and the tier card draws the offer of the period it is on.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy, derivePricing, kitExamples } from "../src/core/derive";
import type { PricingInput } from "../src/core/pricing";
import { presentation } from "./fakes/presentation";

const currency = { code: "EUR", fractionDigits: 2 };
const price = (minor: string) => ({ kind: "price" as const, amount: { minor, currency } });

const tiersInput = (selectedPeriodId: string): PricingInput => ({
  content: {
    phase: "ready",
    refresh: "idle",
    value: [
      {
        id: "individual",
        title: "Individual",
        offers: [
          { periodId: "month", price: price("1299") },
          { periodId: "year", price: price("12990") },
        ],
        features: {},
      },
      {
        id: "household",
        title: "Two adults",
        offers: [
          { periodId: "month", price: price("2199") },
          { periodId: "year", price: price("21990") },
        ],
        features: {},
      },
    ],
  },
  periods: [
    { id: "month", label: "Monthly", unitLabel: "per month" },
    { id: "year", label: "Annual", unitLabel: "per year" },
  ],
  selectedPeriodId,
  features: [],
});

const planRow = (model: unknown, title: string) =>
  (
    model as {
      tiers: {
        plans: {
          title: string;
          offer?: { price?: { text: string; unitLabel?: string; accessibleLabel: string } };
        }[];
      };
    }
  ).tiers.plans.find((row) => row.title === title)!;

for (const language of ["en", "pt"] as const) {
  test(`${language}: every tier amount says what it is charged in`, () => {
    const p = { ...presentation, copy: deriveCopy(language) };
    for (const [periodId, unit] of [
      ["month", "per month"],
      ["year", "per year"],
    ] as const) {
      const result = derivePricing(tiersInput(periodId), p);
      assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
      for (const row of result.value.tiers.plans) {
        assert.ok(row.offer, `${row.title} has an offer for ${periodId}`);
        assert.equal(row.offer!.price?.unitLabel, unit, `${row.title} on ${periodId}`);
        assert.ok(
          row.offer!.price!.accessibleLabel.includes(unit),
          `${row.title} announces its unit: ${row.offer!.price!.accessibleLabel}`,
        );
      }
    }
  });
}

test("the tier figure is the amount of the period the page is on", () => {
  const monthly = derivePricing(tiersInput("month"), presentation);
  const yearly = derivePricing(tiersInput("year"), presentation);
  assert.ok(monthly.ok, monthly.ok ? "" : JSON.stringify(monthly.issues));
  assert.ok(yearly.ok, yearly.ok ? "" : JSON.stringify(yearly.issues));
  assert.equal(
    planRow(monthly.value, "Individual").offer!.price!.text,
    "EUR\u00a012.99",
    "monthly",
  );
  assert.equal(planRow(yearly.value, "Individual").offer!.price!.text, "EUR\u00a0129.90");
});

test("a period that names no unit for its amounts is refused by name", () => {
  const input = tiersInput("month");
  const result = derivePricing(
    { ...input, periods: input.periods.map((period) => ({ ...period, unitLabel: "" })) },
    presentation,
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    ["periods.0.unitLabel"],
  );
  const secondOnly = derivePricing(
    {
      ...input,
      periods: input.periods.map((period, i) => ({
        ...period,
        unitLabel: i ? "" : period.unitLabel,
      })),
    },
    presentation,
  );
  assert.equal(secondOnly.ok, false);
  if (secondOnly.ok) return;
  assert.deepEqual(
    secondOnly.issues.map((issue) => issue.path),
    ["periods.1.unitLabel"],
  );
});

for (const language of ["en", "pt"] as const) {
  test(`${language}: the gallery's tiers price both periods and say which one is drawn`, () => {
    const p = { ...presentation, copy: deriveCopy(language) };
    for (const [period, unit] of [
      ["period-month", p.copy.kit.unitMonthly],
      ["period-year", p.copy.kit.unitYearly],
    ] as const) {
      const result = kitExamples(p, "pricing-tiers/default", { period });
      assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
      const plans = result.value.pricing.tiers.plans;
      assert.equal(plans.length, 2);
      for (const row of plans) {
        assert.ok(row.offer, `${row.title} is offered for ${period}`);
        assert.equal(row.offer!.price!.unitLabel, unit);
      }
      assert.notEqual(plans[0]!.offer!.price!.text, plans[1]!.offer!.price!.text);
    }
  });
}
