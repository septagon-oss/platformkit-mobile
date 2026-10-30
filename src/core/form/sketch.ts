export type SketchPoint = readonly [x: number, y: number, elapsedMs: number];
export type SketchStroke = readonly SketchPoint[];
export type Sketch = readonly SketchStroke[];

export const SKETCH_MAX_STROKES = 400;
export const SKETCH_MAX_POINTS = 20_000;

/** parseSketch accepts only the bounded integer tuple value the server stores. */
export function parseSketch(value: unknown): Sketch | undefined {
  if (!Array.isArray(value) || value.length > SKETCH_MAX_STROKES) return undefined;
  let pointCount = 0;
  for (const stroke of value) {
    if (!Array.isArray(stroke) || stroke.length === 0) return undefined;
    pointCount += stroke.length;
    if (pointCount > SKETCH_MAX_POINTS) return undefined;
    let previous = -1;
    for (const point of stroke) {
      if (
        !Array.isArray(point) ||
        point.length !== 3 ||
        !point.every(Number.isSafeInteger) ||
        point[0] < 0 ||
        point[0] > 1000 ||
        point[1] < 0 ||
        point[1] > 1000 ||
        point[2] < 0 ||
        (previous < 0 && point[2] !== 0) ||
        point[2] < previous
      )
        return undefined;
      previous = point[2];
    }
  }
  return value as Sketch;
}

/** sketchText keeps the ordinary form draft string-shaped without changing the wire value. */
export function sketchText(value: unknown): string {
  const sketch = value === null || value === undefined ? [] : parseSketch(value);
  return sketch === undefined ? "!invalid-sketch" : JSON.stringify(sketch);
}

/** sketchFromText parses the form's one JSON spelling and refuses malformed drafts. */
export function sketchFromText(value: string): Sketch | undefined {
  try {
    return parseSketch(JSON.parse(value) as unknown);
  } catch {
    return undefined;
  }
}

/** sketchPoint projects a touch into the centered square, clamping letterbox input. */
export function sketchPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  elapsedMs: number,
): SketchPoint | undefined {
  if (![x, y, width, height, elapsedMs].every(Number.isFinite) || width <= 0 || height <= 0)
    return undefined;
  const side = Math.min(width, height);
  const left = (width - side) / 2;
  const top = (height - side) / 2;
  const nx = Math.round(((x - left) / side) * 1000);
  const ny = Math.round(((y - top) / side) * 1000);
  return [
    Math.max(0, Math.min(1000, nx)),
    Math.max(0, Math.min(1000, ny)),
    Math.max(0, Math.floor(elapsedMs)),
  ];
}

/** appendSketchPoint refuses a capped point without changing the previous draft. */
export function appendSketchPoint(sketch: Sketch, point: SketchPoint): Sketch | undefined {
  const count = sketch.reduce((total, stroke) => total + stroke.length, 0);
  const active = sketch[sketch.length - 1];
  if (!active || count >= SKETCH_MAX_POINTS) return undefined;
  const last = active[active.length - 1];
  const time = Math.max(last?.[2] ?? 0, point[2]);
  return [...sketch.slice(0, -1), [...active, [point[0], point[1], time]]];
}

/** beginSketch refuses a stroke after the shared stroke or point limit. */
export function beginSketch(sketch: Sketch, point: SketchPoint): Sketch | undefined {
  const count = sketch.reduce((total, stroke) => total + stroke.length, 0);
  if (sketch.length >= SKETCH_MAX_STROKES || count >= SKETCH_MAX_POINTS) return undefined;
  return [...sketch, [[point[0], point[1], 0]]];
}

/** undoSketch removes only the last completed stroke. */
export function undoSketch(sketch: Sketch): Sketch {
  return sketch.slice(0, -1);
}
