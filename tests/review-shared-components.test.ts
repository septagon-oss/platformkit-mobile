// Review 1: acceptance belongs to the requested families, not only the first slice.
import assert from "node:assert/strict";
import test from "node:test";
import * as derive from "../src/core/derive";
import { presentation } from "./fakes/presentation";

test("T0180: every specified component family has its public core factory", () => {
  // These names are the public contracts in docs/shared-mobile-components.md,
  // not a count of files elsewhere in the repository.
  const families = {
    "rich states": ["deriveState"],
    "data list": ["deriveDataList", "deriveChoices", "deriveSelection", "deriveActions"],
    "detail sheet and side panel": ["deriveSurface"],
    "timeline and audit list": ["deriveActivity"],
    stepper: ["deriveStepper", "stepTransition"],
    "availability and slots": ["deriveSlots"],
    calendar: ["deriveCalendar"],
    "product and price": [
      "derivePrice",
      "deriveQuantity",
      "deriveProductCard",
      "cartTotals",
      "deriveCart",
      "deriveSummary",
      "deriveBuyBar",
    ],
    "pricing tiers": ["derivePricing"],
    map: ["deriveMap"],
    media: ["deriveMedia", "deriveMediaHero", "deriveViewer"],
    charts: ["deriveSparkline", "deriveChart", "deriveBars", "deriveStat"],
  };
  const missing = Object.entries(families).flatMap(([family, names]) =>
    names
      .filter((name) => typeof Reflect.get(derive, name) !== "function")
      .map((name) => `${family}: ${name}`),
  );
  assert.deepEqual(missing, [], "renderer packs must be able to import each specified family");
});

test("T0180: invalid secondary recovery refuses the whole model in the caller's language", () => {
  const p = { ...presentation, copy: derive.deriveCopy("pt"), locale: "pt-BR" };
  const input: derive.StateInput = {
    kind: "error",
    issue: {
      code: "write-unknown",
      path: "submit",
      recovery: "correctable",
      message: "O resultado ainda não é conhecido.",
    },
    action: {
      intent: "reconcile",
      control: { id: "lookup", label: "Consultar", state: "ready", tone: "primary" },
    },
    secondary: {
      intent: "next",
      control: { id: "submit-again", label: "Enviar", state: "ready", tone: "plain" },
    },
  };
  const original = JSON.stringify(input);
  const result = derive.deriveState(input, p);
  assert.equal(result.ok, false);
  assert.equal("value" in result, false);
  if (!result.ok)
    assert.deepEqual(result.issues, [
      {
        code: "invalid-input",
        path: "secondary.intent",
        recovery: "immutable",
        message: "Esta informação não é válida.",
      },
    ]);
  assert.equal(JSON.stringify(input), original);
  const valid = derive.deriveState(
    { ...input, secondary: { ...input.secondary!, intent: "dismiss" } },
    p,
  );
  assert.equal(valid.ok, true);
});

test("T0180: independent presentations retain their own locale, zone and copy", () => {
  const input: derive.StateInput = { kind: "offline", updatedAt: "2028-04-15T05:20:00Z" };
  const first = {
    ...presentation,
    locale: "pt-BR",
    timeZone: "Pacific/Honolulu",
    copy: derive.deriveCopy("pt"),
  };
  const second = { ...presentation, locale: "en-NZ", timeZone: "Pacific/Auckland" };
  const before = derive.deriveState(input, first);
  const other = derive.deriveState(input, second);
  assert.ok(before.ok && other.ok);
  assert.equal(before.value.language, "pt");
  assert.equal(other.value.language, "en");
  assert.notEqual(before.value.updatedAt, other.value.updatedAt);
  assert.deepEqual(derive.deriveState(input, first), before);
  assert.ok(Object.isFrozen(before.value));
  assert.ok(Object.isFrozen(before.value.actions));
});

test("T0180: English and Portuguese copy have the same complete nested keys", () => {
  const keys = (value: object, prefix = ""): string[] =>
    Object.entries(value).flatMap(([key, child]) => {
      const path = `${prefix}${key}`;
      return child !== null && typeof child === "object" ? keys(child, `${path}.`) : [path];
    });
  assert.deepEqual(keys(derive.deriveCopy("en")), keys(derive.deriveCopy("pt")));
});

test("T0180: cart totals are exact, allow the empty cart and refuse overflow without a partial total", () => {
  const factory: unknown = Reflect.get(derive, "cartTotals");
  assert.equal(typeof factory, "function", "the specified cartTotals contract must exist");
  // Independent inputs from the published contract. This does not implement
  // totals in a fake; it calls the same core factory renderer packs consume.
  type Currency = { code: string; fractionDigits: number };
  type Money = { minor: string; currency: Currency };
  type TotalsInput = {
    lines: { id: string; unitPrice: Money; quantity: number }[];
    adjustments: { id: string; label: string; amount: Money }[];
    currency: Currency;
  };
  const totals = factory as (input: TotalsInput) => derive.Result<{
    subtotal: Money;
    total: Money;
  }>;
  const currency = { code: "EUR", fractionDigits: 2 };
  const input: TotalsInput = {
    currency,
    lines: [
      { id: "first", unitPrice: { minor: "319", currency }, quantity: 2 },
      { id: "second", unitPrice: { minor: "1249", currency }, quantity: 3 },
    ],
    adjustments: [
      { id: "credit", label: "Credit", amount: { minor: "-400", currency } },
      { id: "charge", label: "Charge", amount: { minor: "125", currency } },
    ],
  };
  const original = JSON.stringify(input);
  const result = totals(input);
  assert.ok(result.ok);
  assert.equal(result.value.subtotal.minor, "4385");
  assert.equal(result.value.total.minor, "4110");
  assert.deepEqual(result.value.total.currency, currency);
  assert.equal(JSON.stringify(input), original);

  const empty = totals({ currency, lines: [], adjustments: [] });
  assert.ok(empty.ok);
  assert.equal(empty.value.total.minor, "0");

  const overflow = totals({
    currency,
    lines: [{ id: "large", unitPrice: { minor: "9223372036854775807", currency }, quantity: 2 }],
    adjustments: [],
  });
  assert.equal(overflow.ok, false);
  assert.equal("value" in overflow, false);
  if (!overflow.ok)
    assert.ok(
      overflow.issues.some(
        (issue) => issue.code === "invalid-input" && issue.recovery === "immutable",
      ),
    );
});
