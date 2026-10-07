// A span of time is one sentence. Formatting two instants and joining them wrote the
// day twice, the zone twice and a raw offset in parentheses — which is what made a
// booking slot and a calendar entry read as raw data rather than as one line each.
import assert from "node:assert/strict";
import test from "node:test";
import { presentedRange } from "../src/core/presentation";

const utc = { locale: "en-GB", timeZone: "UTC" } as const;
const pt = { locale: "pt-PT", timeZone: "UTC" } as const;

const dayCount = (text: string, day: string) => text.split(day).length - 1;

test("a span inside one day names that day once and its two clock times", () => {
  const label = presentedRange(
    new Date("2027-03-09T09:15:00Z"),
    new Date("2027-03-09T09:45:00Z"),
    utc,
  );
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short", day: "numeric" })
    .format(new Date("2027-03-09T09:15:00Z"))
    .replace(/\u202f/g, " ");
  const written = label.replace(/\u202f/g, " ");
  assert.equal(dayCount(written, day), 1, label);
  assert.ok(written.includes("09:15"), label);
  assert.ok(written.includes("09:45"), label);
  // The zone is said once, in its short name, not as an arithmetic offset.
  assert.equal(written.split("UTC").length - 1, 1, label);
  assert.ok(!written.includes("+00:00"), label);
});

test("a span that crosses midnight names both days it touches", () => {
  const label = presentedRange(
    new Date("2027-03-09T22:30:00Z"),
    new Date("2027-03-10T00:15:00Z"),
    utc,
  );
  assert.ok(label.includes("9 Mar"), label);
  assert.ok(label.includes("10 Mar"), label);
  assert.ok(!label.includes("2027"), label);
});

test("the span reads in the language it was asked for, not in the device's", () => {
  const english = presentedRange(
    new Date("2027-03-09T09:15:00Z"),
    new Date("2027-03-09T09:45:00Z"),
    utc,
  );
  const portuguese = presentedRange(
    new Date("2027-03-09T09:15:00Z"),
    new Date("2027-03-09T09:45:00Z"),
    pt,
  );
  // The day is written the way that language writes it — pt-PT uses the numeric
  // form — and the two clock times are the same instants either way.
  assert.notEqual(english, portuguese);
  assert.ok(portuguese.includes("9/03"), portuguese);
  assert.ok(portuguese.includes("09:15") && portuguese.includes("09:45"), portuguese);
});
