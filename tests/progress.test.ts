// The one arithmetic a meter, a stepper rail and a player's scrubber share.
// Each case is a number chosen so a wrong rounding, a swapped numerator or a
// invented denominator shows up in the text a person reads, not only in a float.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy } from "../src/core/copy";
import { clockText, deriveMeter, derivePlayback } from "../src/core/progress";
import type { Presentation } from "../src/core/presentation";

const english: Presentation = {
  copy: deriveCopy("en"),
  locale: "en-GB",
  timeZone: "UTC",
  now: "2026-08-14T12:00:00Z",
  weekStartsOn: 1,
  motion: "reduced",
};
const portuguese: Presentation = {
  ...english,
  copy: deriveCopy("pt"),
  locale: "pt-PT",
};

const ready = <T>(result: { ok: true; value: T } | { ok: false; issues: unknown }): T => {
  assert.ok(result.ok, "the model was refused");
  return result.value;
};
const refused = (
  result: { ok: true; value: unknown } | { ok: false; issues: readonly { path: string }[] },
  path: string,
): void => {
  assert.ok(!result.ok, "the model was accepted");
  assert.deepEqual(
    (result as { ok: false; issues: readonly { path: string }[] }).issues.map((i) => i.path),
    [path],
  );
};

test("a meter of a known whole says the fraction, the value and the denominator", () => {
  const meter = ready(deriveMeter({ value: 3, max: 8, label: "Storage" }, english));
  assert.equal(meter.kind, "determinate");
  assert.equal(meter.fraction, 3 / 8);
  assert.equal(meter.text, "3 of 8");
  assert.equal(meter.reason, undefined);
});

test("the same numbers in another language print that language's words", () => {
  // Deliberately under 1 000: whether a locale groups a thousands digit is
  // Node's ICU build, not the kit's, and this test is about the words.
  const meter = ready(deriveMeter({ value: 3, max: 9, label: "Armazenamento" }, portuguese));
  assert.equal(meter.text, "3 de 9");
});

test("a percent meter is the same fraction read the other way", () => {
  assert.equal(
    ready(deriveMeter({ value: 1, max: 4, format: "percent", label: "Upload" }, english)).text,
    "25%",
  );
});

test("a step rail names the step and the whole, which is what a rail draws marks for", () => {
  assert.equal(
    ready(deriveMeter({ value: 2, max: 3, format: "steps", label: "Checkout" }, english)).text,
    "Step 2 of 3",
  );
});

test("a count with no denominator is its own shape: the number, and no bar", () => {
  const meter = ready(deriveMeter({ value: 7, label: "Queued" }, english));
  assert.equal(meter.kind, "indeterminate");
  assert.equal(meter.text, "7");
  assert.equal(meter.fraction, undefined);
  assert.equal(meter.max, undefined);
  // The reason is the kit's sentence, not a caller's: the meter cannot know why.
  assert.equal(meter.reason, english.copy.kit.unmeasured);
});

test("a meter refuses a denominator it does not have rather than invent one", () => {
  refused(deriveMeter({ value: 4, max: 0, label: "Storage" }, english), "max");
  refused(deriveMeter({ value: 4, max: -1, label: "Storage" }, english), "max");
  refused(deriveMeter({ value: 4, max: 2.5, label: "Storage" }, english), "max");
});

test("a count past the whole is refused at the count, not silently clipped", () => {
  refused(deriveMeter({ value: 9, max: 8, label: "Storage" }, english), "value");
  refused(deriveMeter({ value: -1, max: 8, label: "Storage" }, english), "value");
  refused(deriveMeter({ value: 1.5, max: 8, label: "Storage" }, english), "value");
  refused(deriveMeter({ value: 1, max: 8, label: "  " }, english), "label");
});

test("a clock prints minutes and seconds, and hours only when there are hours", () => {
  assert.equal(clockText(0), "0:00");
  assert.equal(clockText(67), "1:07");
  assert.equal(clockText(599), "9:59");
  assert.equal(clockText(3600), "1:00:00");
  assert.equal(clockText(3727), "1:02:07");
});

test("a player with a total gives elapsed, remaining and a scrubber", () => {
  const play = ready(derivePlayback({ position: 67, total: 247, label: "Track 4" }, english));
  assert.equal(play.kind, "scrubbed");
  assert.equal(play.elapsed, "1:07");
  assert.equal(play.remaining, "3:00 left");
  assert.equal(play.seekable, true);
  assert.equal(play.fraction, 67 / 247);
});

test("a player with no total says how long it has run and refuses to look seekable", () => {
  const play = ready(derivePlayback({ position: 95, label: "Live" }, english));
  assert.equal(play.kind, "elapsed");
  assert.equal(play.elapsed, "1:35");
  assert.equal(play.remaining, undefined);
  assert.equal(play.seekable, false);
  assert.equal(play.fraction, undefined);
  assert.equal(play.reason, english.copy.kit.unmeasured);
});

test("a player refuses a position outside the track and a track of no length", () => {
  refused(derivePlayback({ position: 300, total: 247, label: "Track 4" }, english), "position");
  refused(derivePlayback({ position: -1, total: 247, label: "Track 4" }, english), "position");
  refused(derivePlayback({ position: 0, total: 0, label: "Track 4" }, english), "total");
});

test("a full player reads 0:00 left, not -0:01", () => {
  const play = ready(derivePlayback({ position: 247, total: 247, label: "Track 4" }, english));
  assert.equal(play.remaining, "0:00 left");
  assert.equal(play.fraction, 1);
});
