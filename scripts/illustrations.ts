// illustrations.ts writes the drawing table in src/core/illustrations.ts out as
// assets/illustrations/<name>.svg, so the web workspace embeds the identical set
// rather than a second copy that could drift. The phone never reads these files:
// it renders the same table through its theme. `npm run illustrations` writes
// them, and a file that is not what the table renders is refused as stale.
//
// A written file names no colour of its own: an outline strokes `currentColor`
// and an accent strokes the kernel web stylesheet's own `--pk-color-accent-default`.
// The custom property reaches a stroke through a `style` attribute because `var()`
// is not substituted in a presentation attribute, and it falls back to
// `currentColor` so a file loaded as `<img>` — where custom properties do not
// cross the document boundary — is still a legible drawing rather than an
// invisible one. Emission is deterministic, so a rerun over an unchanged table
// rewrites the bytes it replaced.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  illustrationCanvas,
  illustrationNames,
  illustrationStroke,
  illustrations,
  type IllustrationName,
} from "../src/core/illustrations";

export const OUTPUT = path.join("assets", "illustrations");

/** HEADER names the source of a written file, so nobody edits a generated drawing. */
export const HEADER =
  "<!-- Generated from src/core/illustrations.ts by npm run illustrations. Do not edit. -->";

/** INK is how each role in a drawing is asked of the page that embeds it. */
export const INK: Record<"line" | "detail", string> = {
  line: 'stroke="currentColor"',
  detail: 'style="stroke:var(--pk-color-accent-default,currentColor)"',
};

/**
 * svgOf is one drawing as a file: one canvas, stroked and unfilled throughout,
 * each part in the ink the table names it. It carries no colour literal, so the
 * same bytes serve a light page and a dark one.
 */
export function svgOf(name: IllustrationName): string {
  const side = `${illustrationCanvas}`;
  const open =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${side}" height="${side}" ` +
    `fill="none" stroke-width="${illustrationStroke}" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" focusable="false">`;
  return [
    HEADER,
    open,
    ...illustrations[name].parts.map((part) => `<path d="${part.d}" ${INK[part.ink]}/>`),
    "</svg>",
  ].join("\n");
}

/** write puts every drawing in the vocabulary at its own path and returns what it wrote. */
export function write(root = process.cwd()): string[] {
  mkdirSync(path.join(root, OUTPUT), { recursive: true });
  return illustrationNames.map((name) => {
    const file = path.join(root, OUTPUT, `${name}.svg`);
    writeFileSync(file, `${svgOf(name)}\n`);
    return path.join(OUTPUT, `${name}.svg`);
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  for (const file of write()) console.log(file);
}
