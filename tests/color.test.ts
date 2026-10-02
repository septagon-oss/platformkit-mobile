// The arithmetic every derived colour and every measured ratio comes through.
// Each expectation is a number the standard or a hand computes, not the output
// of the function under test: the first run of this file found parseColor
// reading a six-digit hex as four digits per channel, which turned every mix
// into white and every contrast ratio into one.
import assert from "node:assert/strict";
import test from "node:test";
import {
  AA,
  alpha,
  contrastRatio,
  encodeColor,
  meetsAA,
  mix,
  parseColor,
  relativeLuminance,
} from "../src/core/color";

test("a hex of three, six or eight digits reads as the bytes it spells", () => {
  assert.deepEqual(parseColor("#f00"), [255, 0, 0, 1]);
  assert.deepEqual(parseColor("#00ff00"), [0, 255, 0, 1]);
  assert.deepEqual(parseColor(" #8F988F "), [143, 152, 143, 1]);
  assert.deepEqual(parseColor("#00ff0080").slice(0, 3), [0, 255, 0]);
  assert.equal(Math.round((parseColor("#00ff0080")[3] ?? 0) * 255), 128);
});

test("an rgb or rgba string reads as its numbers, and anything else is refused by name", () => {
  assert.deepEqual(parseColor("rgba(10, 20, 30, 0.25)"), [10, 20, 30, 0.25]);
  assert.deepEqual(parseColor("rgb(10,20,30)"), [10, 20, 30, 1]);
  for (const token of ["#12345", "rebeccapurple", "", "rgb(a,0,0)"])
    assert.throws(() => parseColor(token), /invalid color/);
});

test("encodeColor writes the shortest form that keeps the alpha it carries", () => {
  assert.equal(encodeColor([143, 152, 143, 1]), "#8f988f");
  assert.equal(alpha("#ff0000", 0.5), "rgba(255, 0, 0, 0.5)");
  assert.throws(() => alpha("#ff0000", 1.5), /invalid color: alpha 1.5/);
  assert.throws(() => mix("#ffffff", "#000000", -0.1), /invalid color: weight -0.1/);
});

test("a mix blends in linear light, which is why half black is not half grey", () => {
  // 0.5 linear light re-encoded as sRGB is 1.055 x 0.5^(1/2.4) - 0.055 = 0.7354,
  // which is 188 per channel: #bcbcbc, not the #808080 a byte blend gives.
  assert.equal(mix("#ffffff", "#000000", 0.5), "#bcbcbc");
  assert.equal(mix("#fffdf7", "#0f5d4e", 0), "#fffdf7");
  assert.equal(mix("#fffdf7", "#0f5d4e", 1), "#0f5d4e");
});

test("luminance and ratio are the standard's, on colours it scores", () => {
  assert.equal(relativeLuminance("#000000"), 0);
  assert.equal(Math.round(relativeLuminance("#ffffff")), 1);
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#ffffff", "#000000"), 21);
  // The pair a mid-grey border fails: #777 on white is 4.478, under body text.
  assert.equal(contrastRatio("#777777", "#ffffff"), 4.478);
  assert.equal(contrastRatio("#777777", "#777777"), 1);
});

test("AA names the three minimums the kit measures against", () => {
  assert.deepEqual(AA, { text: 4.5, large: 3, graphic: 3 });
  assert.equal(meetsAA(4.5, "text"), true);
  assert.equal(meetsAA(4.49, "text"), false);
  assert.equal(meetsAA(3, "graphic"), true);
});
