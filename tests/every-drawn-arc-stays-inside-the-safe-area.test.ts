// A drawing's ink stays inside the safe area, not only the numbers it writes. An arc's
// end and radius can sit inside the box while the curve between them bulges out of it,
// and an arc whose chord is longer than its diameter is silently drawn with a larger
// radius than the one written. So every part is walked as it is drawn — lines at their
// ends, cubics along their length, arcs from their own centre — and the farthest point
// the stroke reaches is held to the safe area of the shared canvas.
import assert from "node:assert/strict";
import test from "node:test";
import {
  illustrationCanvas,
  illustrationNames,
  illustrationSafeArea,
  illustrations,
} from "../src/core/illustrations";

type Point = readonly [number, number];

/** commands reads a path into its absolute commands and the numbers each carries. */
const commands = (d: string) =>
  [...d.matchAll(/([MLCAZ])([^MLCAZ]*)/g)].map((m) => ({
    command: m[1]!,
    numbers: (m[2]!.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number),
  }));

/**
 * arc is every point of one circular arc from `from` to `to`, found from its centre the
 * way SVG finds it (rx = ry, no rotation, as every drawing writes them).
 */
function arc(from: Point, r: number, large: number, sweep: number, to: Point): Point[] {
  const half = Math.hypot(to[0] - from[0], to[1] - from[1]) / 2;
  assert.ok(half <= r + 1e-9, `an arc of radius ${r} cannot span a chord of ${half * 2}`);
  const mid: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const along: Point = [(to[0] - from[0]) / (2 * half), (to[1] - from[1]) / (2 * half)];
  const reach = Math.sqrt(Math.max(0, r * r - half * half)) * (large === sweep ? -1 : 1);
  const centre: Point = [mid[0] - along[1] * reach, mid[1] + along[0] * reach];
  const start = Math.atan2(from[1] - centre[1], from[0] - centre[0]);
  let turn = Math.atan2(to[1] - centre[1], to[0] - centre[0]) - start;
  if (sweep && turn < 0) turn += 2 * Math.PI;
  if (!sweep && turn > 0) turn -= 2 * Math.PI;
  return Array.from({ length: 361 }, (_, i) => {
    const angle = start + (turn * i) / 360;
    return [centre[0] + r * Math.cos(angle), centre[1] + r * Math.sin(angle)] as Point;
  });
}

/** inked is every point the stroke of one part passes through. */
function inked(d: string): Point[] {
  const points: Point[] = [];
  let at: Point = [0, 0];
  let start: Point = [0, 0];
  for (const { command, numbers: n } of commands(d)) {
    if (command === "M") start = at = [n[0]!, n[1]!];
    else if (command === "L") at = [n[0]!, n[1]!];
    else if (command === "Z") at = start;
    else if (command === "C") {
      const from = at;
      for (let i = 0; i <= 100; i++) {
        const t = i / 100,
          u = 1 - t;
        points.push([
          u ** 3 * from[0] + 3 * u * u * t * n[0]! + 3 * u * t * t * n[2]! + t ** 3 * n[4]!,
          u ** 3 * from[1] + 3 * u * u * t * n[1]! + 3 * u * t * t * n[3]! + t ** 3 * n[5]!,
        ]);
      }
      at = [n[4]!, n[5]!];
    } else if (command === "A") {
      assert.equal(n[0], n[1], `${d}: every arc in the set is circular`);
      points.push(...arc(at, n[0]!, n[3]!, n[4]!, [n[5]!, n[6]!]));
      at = [n[5]!, n[6]!];
    }
    points.push(at);
  }
  return points;
}

const edge = illustrationCanvas - illustrationSafeArea;
const inside = (value: number) => value >= illustrationSafeArea - 1e-6 && value <= edge + 1e-6;

test("every stroke of every drawing reaches no farther than the safe area", () => {
  for (const name of illustrationNames)
    for (const part of illustrations[name].parts)
      for (const [x, y] of inked(part.d))
        assert.ok(
          inside(x) && inside(y),
          `${name}: the stroke reaches (${x.toFixed(2)}, ${y.toFixed(2)}), outside [${illustrationSafeArea}, ${edge}]: ${part.d}`,
        );
});

test("an arc that bulges past the safe area is caught although its numbers sit inside it", () => {
  // A ring centred near the top edge: its two ends and its radius are all in the box,
  // and its upper half is not.
  const near = "M8 6 A4 4 0 0 1 16 6 A4 4 0 0 1 8 6 Z";
  assert.ok(inked(near).some(([, y]) => !inside(y)));
  assert.throws(() => inked("M4 24 A4 4 0 0 1 40 24"), /cannot span a chord/);
});
