// illustrations.ts holds the set of line pictures an empty screen is drawn with:
// one per icon a catalogue may declare, plus the generic one and the magnifier a
// filtered-empty list asks for. A drawing is data — stroked paths on one canvas —
// so the phone renders it through the theme's two ink tokens, the emitter in
// scripts/illustrations.ts writes the identical bytes for the web twin, and one
// test can read the geometry of every drawing in the set.
//
// Three rules make eighteen drawings read as one set rather than eighteen
// drawings. They share illustrationCanvas, so every picture scales as one
// picture; every coordinate they write stays inside illustrationSafeArea, so the
// stroke is never clipped at the edge and every object breathes by the same
// margin; and each is at most a handful of stroked parts, because a picture with
// twenty parts is a diagram. A part names an ink, never a colour: which token
// that ink is belongs to the theme, so the set follows light and dark for free.
//
// The canvas, the safe area and the stroke are units of the drawing's own grid,
// not points: the side a picture is drawn at is a length and lives in
// src/ui/scale.ts, which reads illustrationStroke from here.
import { resourceIcons } from "./pictures";

/** illustrationCanvas is the square every drawing is authored on; no drawing carries its own. */
export const illustrationCanvas = 48;
/** illustrationSafeArea is the margin no coordinate of a drawing crosses, so a stroke is never clipped. */
export const illustrationSafeArea = 4;
/** illustrationStroke is every part's stroke width in canvas units — twice a hairline at the side a picture is drawn at. */
export const illustrationStroke = 1.5;

/** IllustrationInk is the role a stroke plays: the object's outline, or the one part that says what it is. */
export type IllustrationInk = "line" | "detail";

export interface IllustrationPart {
  readonly d: string;
  readonly ink: IllustrationInk;
}

/** Illustration is one picture: its stroked parts, in draw order. It carries no size and no colour. */
export interface Illustration {
  readonly parts: readonly IllustrationPart[];
}

/** Point is one coordinate of a drawing, on the shared canvas. */
type Point = readonly [number, number];

/** card draws a rounded rectangle — the backbone of every object-shaped drawing in the set. */
export function card(x: number, y: number, w: number, h: number, r: number): string {
  const right = x + w;
  const bottom = y + h;
  return (
    `M${x + r} ${y} L${right - r} ${y} A${r} ${r} 0 0 1 ${right} ${y + r} ` +
    `L${right} ${bottom - r} A${r} ${r} 0 0 1 ${right - r} ${bottom} ` +
    `L${x + r} ${bottom} A${r} ${r} 0 0 1 ${x} ${bottom - r} ` +
    `L${x} ${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`
  );
}

/** ring draws a circle as two half arcs, so a part needs no command beyond A. */
export function ring(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy} A${r} ${r} 0 0 1 ${cx - r} ${cy} Z`;
}

/** poly draws a polyline, closed into a shape when asked; a run of straight edges is the friendliest outline. */
export function poly(points: readonly Point[], closed = false): string {
  const run = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  return closed ? `${run} Z` : run;
}

const line = (d: string): IllustrationPart => ({ d, ink: "line" });
const detail = (d: string): IllustrationPart => ({ d, ink: "detail" });

/**
 * illustrationNames is the closed vocabulary a picture exists for: every icon the
 * catalogue may declare (resourceIcons), the generic picture an entry without a
 * declared icon gets, and the magnifier a list narrowed to nothing draws.
 */
export const illustrationNames = [...resourceIcons, "empty", "filtered"] as const;
export type IllustrationName = (typeof illustrationNames)[number];

/** isIllustrationName decides whether a word names a drawing this build holds; a state model refuses any other. */
export function isIllustrationName(value: unknown): value is IllustrationName {
  return (illustrationNames as readonly string[]).includes(value as string);
}

/**
 * illustrations is the drawing for each name, keyed by the icon word so the
 * phone, the emitted file and the web twin share one identity per picture.
 */
export const illustrations: Readonly<Record<IllustrationName, Illustration>> = {
  task: {
    parts: [
      line(card(9, 7, 30, 34, 5)),
      line(
        poly([
          [15, 16],
          [33, 16],
        ]),
      ),
      line(
        poly([
          [15, 23],
          [29, 23],
        ]),
      ),
      detail(
        poly([
          [17, 31],
          [21, 35],
          [31, 26],
        ]),
      ),
    ],
  },
  person: {
    parts: [line(ring(24, 17, 7)), detail("M8 40 A18 18 0 0 1 40 40")],
  },
  people: {
    parts: [
      line(ring(19, 16, 7)),
      line(ring(35, 21, 5)),
      line("M8 40 A16 16 0 0 1 30 40"),
      detail("M32 39 A8 8 0 0 1 44 39"),
    ],
  },
  document: {
    parts: [
      line(
        poly(
          [
            [13, 6],
            [29, 6],
            [36, 13],
            [36, 42],
            [13, 42],
          ],
          true,
        ),
      ),
      line(
        poly([
          [18, 25],
          [31, 25],
        ]),
      ),
      detail(
        poly([
          [29, 6],
          [29, 13],
          [36, 13],
        ]),
      ),
    ],
  },
  settings: {
    parts: [
      line(
        poly([
          [8, 17],
          [40, 17],
        ]),
      ),
      line(
        poly([
          [8, 31],
          [40, 31],
        ]),
      ),
      detail(ring(18, 17, 5)),
      detail(ring(31, 31, 5)),
    ],
  },
  plan: {
    parts: [
      line(ring(12, 38, 4)),
      line("M15 35 C6 28 24 30 30 28"),
      detail(ring(32, 16, 5)),
      detail(
        poly([
          [32, 21],
          [32, 28],
        ]),
      ),
    ],
  },
  calendar: {
    parts: [
      line(card(8, 11, 32, 29, 4)),
      line(
        poly([
          [17, 5],
          [17, 12],
        ]),
      ),
      line(
        poly([
          [31, 5],
          [31, 12],
        ]),
      ),
      line(
        poly([
          [8, 19],
          [40, 19],
        ]),
      ),
      detail(ring(24, 29, 4)),
    ],
  },
  folder: {
    parts: [
      line(
        poly(
          [
            [7, 40],
            [7, 13],
            [20, 13],
            [25, 18],
            [41, 18],
            [41, 40],
          ],
          true,
        ),
      ),
      detail(
        poly([
          [7, 24],
          [41, 24],
        ]),
      ),
    ],
  },
  chart: {
    parts: [
      line(
        poly([
          [10, 8],
          [10, 38],
          [40, 38],
        ]),
      ),
      line(
        poly([
          [16, 38],
          [16, 29],
        ]),
      ),
      detail(
        poly([
          [25, 38],
          [25, 14],
        ]),
      ),
      line(
        poly([
          [34, 38],
          [34, 23],
        ]),
      ),
    ],
  },
  message: {
    parts: [
      line(card(6, 9, 36, 23, 6)),
      line(
        poly([
          [16, 32],
          [13, 41],
          [24, 32],
        ]),
      ),
      detail(`${ring(14, 21, 4)} ${ring(24, 21, 4)} ${ring(34, 21, 4)}`),
    ],
  },
  money: {
    parts: [line(card(5, 15, 38, 20, 4)), detail(ring(24, 25, 6))],
  },
  box: {
    parts: [
      line(
        poly(
          [
            [24, 6],
            [42, 15],
            [42, 33],
            [24, 42],
            [6, 33],
            [6, 15],
          ],
          true,
        ),
      ),
      line(
        poly([
          [24, 24],
          [24, 42],
        ]),
      ),
      detail(
        poly([
          [6, 15],
          [24, 24],
          [42, 15],
        ]),
      ),
    ],
  },
  tag: {
    parts: [
      line(
        poly(
          [
            [16, 12],
            [41, 12],
            [41, 36],
            [16, 36],
            [6, 24],
          ],
          true,
        ),
      ),
      detail(ring(15, 24, 4)),
    ],
  },
  building: {
    parts: [
      line(card(12, 7, 24, 35, 4)),
      line("M17 15 L21 15 M25 15 L29 15 M17 23 L21 23 M25 23 L29 23"),
      detail(
        poly([
          [20, 42],
          [20, 32],
          [28, 32],
          [28, 42],
        ]),
      ),
    ],
  },
  location: {
    parts: [
      line(ring(24, 18, 10)),
      line(
        poly([
          [17, 25],
          [24, 39],
          [31, 25],
        ]),
      ),
      detail(ring(24, 18, 4)),
    ],
  },
  link: {
    parts: [
      line(ring(16, 32, 6)),
      line(ring(32, 16, 6)),
      detail(
        poly([
          [21, 27],
          [27, 21],
        ]),
      ),
    ],
  },
  empty: {
    parts: [
      line(
        poly([
          [8, 21],
          [8, 39],
          [40, 39],
          [40, 21],
        ]),
      ),
      detail(
        poly([
          [8, 21],
          [4, 13],
          [16, 17],
          [24, 21],
          [32, 17],
          [44, 13],
          [40, 21],
        ]),
      ),
    ],
  },
  filtered: {
    parts: [
      line(ring(21, 21, 11)),
      detail(
        poly([
          [29, 29],
          [39, 39],
        ]),
      ),
    ],
  },
};
