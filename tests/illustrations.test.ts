// An illustration exists for every icon a catalogue may declare: one canvas, one
// safe area, one stroke, and two inks that name no colour. The vocabulary, the
// geometry and the emitted assets/illustrations/<name>.svg are all read back off
// one table, so a drawing that is missing, that leaves its box, or that differs
// from what the table renders is a failing test rather than a screen that quietly
// draws nothing.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  illustrationCanvas,
  illustrationNames,
  illustrationSafeArea,
  illustrations,
} from "../src/core/illustrations";
import { resourceIcons } from "../src/core/pictures";
import { HEADER, INK, OUTPUT, svgOf } from "../scripts/illustrations";

/** segments reads a path's commands and the numbers each one carries. */
function segments(d: string) {
  return [...d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)].map((m) => ({
    command: m[1]!,
    numbers: (m[2]!.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number),
  }));
}

/**
 * measured is every number of a command that states a place on the canvas: the
 * points of M, L and C, and for an arc its two radii and its end — the rotation
 * and the two flags of an A are not places and are checked by their own rule.
 */
function measured(command: string, numbers: readonly number[]): readonly number[] {
  if (command === "A") return [numbers[0]!, numbers[1]!, ...numbers.slice(5)];
  return command === "Z" ? [] : numbers;
}

const ARITY: Record<string, number> = { M: 2, L: 2, C: 6, A: 7, Z: 0 };
const edge = illustrationCanvas - illustrationSafeArea;
const drawings = illustrationNames.map((name) => [name, illustrations[name]] as const);

test("every icon a catalogue may declare has a drawing, and the vocabulary is those plus two", () => {
  for (const icon of resourceIcons)
    assert.ok(
      (illustrationNames as readonly string[]).includes(icon),
      `${icon}: no illustration in the closed set`,
    );
  assert.deepEqual(
    [...illustrationNames].sort(),
    [...new Set([...resourceIcons, "empty", "filtered"])].sort(),
    "the vocabulary is the closed icon set plus the generic and the filtered picture",
  );
  assert.deepEqual(
    Object.keys(illustrations).sort(),
    [...illustrationNames].sort(),
    "every name has a drawing and no drawing is nameless",
  );
});

test("every drawing lies inside the safe area on the shared canvas, in absolute commands", () => {
  for (const [name, drawing] of drawings)
    for (const part of drawing.parts)
      for (const { command, numbers } of segments(part.d)) {
        assert.equal(
          Object.hasOwn(ARITY, command),
          true,
          `${name}: command "${command}" is not one the set draws with`,
        );
        assert.equal(
          numbers.length,
          ARITY[command],
          `${name}: ${command} carries ${numbers.length} numbers, not ${ARITY[command]}: ${part.d}`,
        );
        if (command === "A") {
          const [rotation, large, sweep] = numbers.slice(2, 5) as [number, number, number];
          assert.deepEqual(
            [rotation, large, sweep],
            [0, 0, 1],
            `${name}: an arc turns the same way as every other arc: ${part.d}`,
          );
        }
        for (const value of measured(command, numbers))
          assert.ok(
            value >= illustrationSafeArea && value <= edge,
            `${name}: ${command} writes ${value}, outside the safe area [${illustrationSafeArea}, ${edge}]: ${part.d}`,
          );
      }
});

test("a drawing is a handful of stroked parts, outlined in one ink and accented in the other", () => {
  for (const [name, drawing] of drawings) {
    assert.ok(drawing.parts.length <= 8, `${name}: ${drawing.parts.length} parts is a diagram`);
    const detail = drawing.parts.filter((part) => part.ink === "detail").length;
    assert.ok(
      detail >= 1 && detail <= 2,
      `${name}: ${detail} accent parts — a drawing says the point once or twice`,
    );
    assert.ok(
      drawing.parts.some((part) => part.ink === "line"),
      `${name}: nothing is outlined`,
    );
    for (const part of drawing.parts) {
      assert.ok(
        ["line", "detail"].includes(part.ink),
        `${name}: ink "${part.ink}" is not one the theme can answer for`,
      );
      assert.ok(
        part.d.length <= 160,
        `${name}: a ${part.d.length}-character part is a diagram, not a line: ${part.d}`,
      );
      assert.doesNotMatch(part.d, /[a-z]/, `${name}: commands are absolute`);
    }
    assert.equal(
      new Set(drawing.parts.map((part) => part.d)).size,
      drawing.parts.length,
      `${name}: two parts are the same stroke`,
    );
  }
});

test("the emitted files are the table's own bytes, one per name, and name no colour", () => {
  const written = readdirSync(path.resolve(OUTPUT)).sort();
  assert.deepEqual(
    written,
    illustrationNames.map((name) => `${name}.svg`).sort(),
    `${OUTPUT}: the files on disk are the vocabulary, no more and none missing`,
  );
  for (const name of illustrationNames) {
    const file = path.resolve(OUTPUT, `${name}.svg`);
    assert.ok(existsSync(file), `${name}: no emitted file`);
    assert.equal(
      readFileSync(file, "utf8"),
      `${svgOf(name)}\n`,
      `${file} is stale: run npm run illustrations`,
    );
    const body = readFileSync(file, "utf8");
    assert.doesNotMatch(body, /#/, `${file}: a generated drawing writes no colour literal`);
    assert.doesNotMatch(body, /<text/, `${file}: a picture says nothing a person has to read`);
    assert.match(body, new RegExp(`^${HEADER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "u"));
    const strokes = [...body.matchAll(/<path[^>]*>/g)].map((m) =>
      m[0].includes(INK.line) ? "line" : m[0].includes(INK.detail) ? "detail" : "none",
    );
    assert.deepEqual(
      strokes,
      illustrations[name].parts.map((part) => part.ink),
      `${file}: each part is drawn in the ink the table names it`,
    );
  }
});
