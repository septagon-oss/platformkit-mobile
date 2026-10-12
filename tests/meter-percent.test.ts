// A percentage a person reads is a promise about where the work stands: an
// unfinished whole never reads 100%, and a started one never reads 0%.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy } from "../src/core/copy";
import type { Presentation } from "../src/core/presentation";
import { deriveMeter } from "../src/core/progress";

const english: Presentation = {
  copy: deriveCopy("en"),
  locale: "en-GB",
  timeZone: "UTC",
  ownZone: "UTC",
  now: "2026-07-18T09:00:00Z",
  weekStartsOn: 1,
  motion: "reduced",
};

const percent = (value: number, max: number): string => {
  const result = deriveMeter({ value, max, format: "percent", label: "Upload" }, english);
  assert.ok(result.ok);
  return result.value.text;
};

test("a meter one short of its whole does not print 100%", () => {
  assert.notEqual(percent(199, 200), "100%");
  assert.equal(percent(200, 200), "100%");
});

test("a meter one past nothing does not print 0%", () => {
  assert.notEqual(percent(1, 300), "0%");
  assert.equal(percent(0, 300), "0%");
});
