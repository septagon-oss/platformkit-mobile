// Measured card geometry owns direction arbitration, inclusive thresholds, overlay and capped tilt.
import assert from "node:assert/strict";
import test from "node:test";
import { readDeckDrag } from "../src/core/gesture";
const directions = ["left", "down", "up", "right"];
const read = (x: number, y: number, offered = directions, reduced = false) =>
  readDeckDrag(x, y, 360, 640, offered, reduced);

test("a third of card width and a quarter of height arm at exact equality", () => {
  for (const [x, y, direction, armed] of [
    [119, 0, "right", false],
    [120, 0, "right", true],
    [121, 0, "right", true],
    [-120, 0, "left", true],
    [0, -160, "up", true],
    [0, 160, "down", true],
    [0, 159.5, "down", false],
  ] as const) {
    const result = read(x, y);
    assert.equal(result.direction, direction);
    assert.equal(result.armed, armed);
  }
});
test("normalized ties choose horizontal and unavailable candidates never fall back to another axis", () => {
  assert.equal(read(120, 160).direction, "right");
  assert.equal(read(119, 240).direction, "down");
  assert.deepEqual(read(119, 240, ["right"]), {
    direction: "down",
    armed: false,
    opacity: 0,
    tilt: 11.9,
  });
});
test("tilt is capped and reduced motion preserves decisions while removing tilt", () => {
  assert.equal(read(240, 160).tilt, 12);
  assert.equal(read(-240, 160).tilt, -12);
  assert.deepEqual(read(240, 160, directions, true), {
    direction: "right",
    armed: true,
    opacity: 1,
    tilt: 0,
  });
});
test("unmeasured, nonfinite and overflowed geometry is neutral", () => {
  const neutral = { direction: undefined, armed: false, opacity: 0, tilt: 0 };
  assert.deepEqual(read(0, 0), neutral);
  for (const [x, y, w, h] of [
    [NaN, 0, 360, 640],
    [0, Infinity, 360, 640],
    [120, 0, 0, 640],
    [120, 0, -1, 640],
    [120, 0, Number.MIN_VALUE, 640],
    [Number.MAX_VALUE, 0, 1, 1],
  ])
    assert.deepEqual(readDeckDrag(x!, y!, w!, h!, directions), neutral);
});

test("the real Worklets compiler serializes the helper without a remote closure and an isolated runtime can call it", async () => {
  const { createRequire } = await import("node:module");
  const vm = await import("node:vm");
  const require = createRequire(import.meta.url);
  const babel = require("@babel/core") as {
    transformSync: (source: string, options: unknown) => { code: string };
  };
  const { code } = babel.transformSync(`var read = ${readDeckDrag.toString()};`, {
    filename: "src/core/gesture.ts",
    configFile: false,
    babelrc: false,
    plugins: ["react-native-worklets/plugin"],
  });
  const context = vm.createContext({ global: { Error } });
  vm.runInContext(code, context);
  const compiled = context.read as { __closure: object; __initData: { code: string } };
  assert.deepEqual(Object.keys(compiled.__closure), []);
  const runtime = vm.runInNewContext(`(${compiled.__initData.code})`) as typeof readDeckDrag;
  assert.equal(runtime.call({ __closure: {} }, 120, 0, 360, 640, ["right"], false).armed, true);
  assert.equal(runtime.call({ __closure: {} }, 119, 0, 360, 640, ["right"], false).armed, false);
});
