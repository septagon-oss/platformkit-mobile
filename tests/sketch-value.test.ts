// The mobile sketch value and form draft enforce the kernel's bounded wire shape.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import {
  appendSketchPoint,
  beginSketch,
  parseSketch,
  sketchFromText,
  sketchPoint,
  sketchText,
  undoSketch,
  type Sketch,
  formControls,
  values,
} from "../src/core/form";
import { unresolved } from "./fakes/unresolved";

test("sketch values accept only bounded normalized integer strokes", () => {
  assert.deepEqual(parseSketch([]), []);
  assert.deepEqual(
    parseSketch([
      [
        [0, 1000, 0],
        [1000, 0, 8],
      ],
    ]),
    [
      [
        [0, 1000, 0],
        [1000, 0, 8],
      ],
    ],
  );
  for (const bad of [
    {},
    [[]],
    [[[0, 0, 1]]],
    [
      [
        [0, 0, 0],
        [1001, 0, 1],
      ],
    ],
    [
      [
        [0, 0, 0],
        [0, 0, -1],
      ],
    ],
    [
      [
        [0, 0, 0],
        [0, 0, 1.5],
      ],
    ],
  ])
    assert.equal(parseSketch(bad), undefined);
});

test("sketch touch decisions normalize letterboxed input and preserve stroke order", () => {
  const first = sketchPoint(50, 0, 200, 100, 0)!;
  const last = sketchPoint(150, 100, 200, 100, 9)!;
  assert.deepEqual(first, [0, 0, 0]);
  assert.deepEqual(last, [1000, 1000, 9]);
  const one = beginSketch([], first)!;
  const extended = appendSketchPoint(one, last)!;
  const two = beginSketch(extended, [50, 50, 0])!;
  assert.deepEqual(undoSketch(two), extended);
});

test("sketch form text round-trips wire values and absent values stay empty", () => {
  const value: Sketch = [[[12, 15, 0]]];
  assert.deepEqual(sketchFromText(sketchText(value)), value);
  assert.equal(sketchText(null), "[]");
  assert.equal(sketchFromText("bad"), undefined);
});

test("sketch forms submit an absent or cleared drawing as an empty array", () => {
  const catalog = parseCatalog(
    unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8")) as unknown),
  );
  const entry = catalog.resources.find((resource) => resource.entity === "note")!;
  const controls = formControls(entry, undefined, true);
  const drawing = controls.find((control) => control.field.name === "drawing")!;
  assert.deepEqual(values(controls, {})[drawing.field.name], []);
  assert.deepEqual(values(controls, { [drawing.field.name]: "[]" })[drawing.field.name], []);
});

test("sketch actions refuse the next stroke or point at either kernel cap", () => {
  const onePoint = [[0, 0, 0]] as const;
  const strokes = Array.from({ length: 400 }, () => onePoint);
  assert.equal(parseSketch(strokes)?.length, 400);
  assert.equal(beginSketch(strokes, [0, 0, 0]), undefined);
  const points = Array.from({ length: 20_000 }, (_, at) => [0, 0, at] as const);
  const atPointLimit: Sketch = [points];
  assert.ok(parseSketch(atPointLimit));
  assert.equal(appendSketchPoint(atPointLimit, [0, 0, 20_000]), undefined);
});
