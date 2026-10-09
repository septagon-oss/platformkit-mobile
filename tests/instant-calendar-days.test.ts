// A past instant read as a distance names the calendar day it fell on, not the
// number of whole 24-hour spans since it: a record written late on Monday is not
// "yesterday" on Wednesday morning.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy, presentedInstant, type Formatting } from "../src/core/derive";

const under = (now: string, language: "en" | "pt", locale: string): Formatting => ({
  copy: deriveCopy(language),
  locale,
  timeZone: "UTC",
  ownZone: "UTC",
  now,
});

test("an instant two calendar days back is never called yesterday", () => {
  // Monday 29 June 15:00, read on Wednesday 1 July at 12:00: 45 hours, two days.
  const { shown, exact } = presentedInstant(
    new Date("2026-06-29T15:00:00Z"),
    under("2026-07-01T12:00:00Z", "en", "en-US"),
  );
  assert.match(exact, /Jun 29/);
  assert.doesNotMatch(shown, /yesterday/i);
  assert.match(shown, /2 days ago|Jun 29/);
});

test("a day word in Portuguese counts calendar days too", () => {
  // Monday 29 June 23:30, read on Thursday 2 July at 00:30: three days back, not anteontem.
  const { shown } = presentedInstant(
    new Date("2026-06-29T23:30:00Z"),
    under("2026-07-02T00:30:00Z", "pt", "pt-PT"),
  );
  assert.doesNotMatch(shown, /anteontem|ontem/i);
  assert.match(shown, /3 dias|29/);
});

test("yesterday late in the evening is still yesterday", () => {
  // The passing branch the rule already has: one calendar day back, under 24 hours.
  const { shown } = presentedInstant(
    new Date("2026-06-30T22:00:00Z"),
    under("2026-07-01T09:00:00Z", "en", "en-US"),
  );
  assert.match(shown, /^Yesterday, /);
});
