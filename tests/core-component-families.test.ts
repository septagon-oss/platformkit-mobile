import assert from "node:assert/strict";
import test from "node:test";
import * as derive from "../src/core/derive";

// The families are named in docs/shared-mobile-components.md; a renderer pack
// imports each one by name, so the name has to be a function the core exports.
test("every specified component family has its public core factory", () => {
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
