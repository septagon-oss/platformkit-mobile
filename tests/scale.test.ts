import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// A distance is written once, in src/ui/scale.ts. This reads every other
// presentation source and refuses a nonzero numeric literal where a style or
// a prop asks for a length, so a bypass is a failing test and not a review
// comment. Zero is not a distance, a percentage is a string, a token halved
// is still the token, and flex, opacity, elevation and letter spacing are not
// lengths; a literal added to an inset is.
const ROOTS = ["src/ui", "src/screens", "src/route.tsx", "src/shell.tsx", "app"];
const EXEMPT = new Set(["src/ui/scale.ts"]);
const LENGTH =
  /\b((?:padding|margin)(?:Top|Bottom|Left|Right|Start|End|Horizontal|Vertical)?|gap|rowGap|columnGap|borderRadius|width|height|minWidth|minHeight|maxWidth|maxHeight|top|bottom|left|right|hitSlop|size|fontSize|lineHeight)\s*[:=]\s*\{?\s*(?:[\w.]+\s*[+-]\s*)*([1-9]\d*(?:\.\d+)?)\b/g;

function files(at: string): string[] {
  const full = path.resolve(at);
  if (
    !readdirSync(path.dirname(full), { withFileTypes: true }).some(
      (d) => d.name === path.basename(full) && d.isDirectory(),
    )
  )
    return [at];
  return readdirSync(full, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(path.join(at, d.name)) : [path.join(at, d.name)],
  );
}

test("no distance is written outside src/ui/scale.ts", () => {
  const found: string[] = [];
  for (const file of ROOTS.flatMap(files)) {
    if (!/\.tsx?$/.test(file) || EXEMPT.has(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(LENGTH)) {
      const line = source.slice(0, m.index).split("\n").length;
      found.push(`${file}:${line}: ${m[1]} ${m[2]}`);
    }
  }
  assert.deepEqual(found, [], "these lengths belong in src/ui/scale.ts");
});

test("the guard reads what a component writes, and lets a zero and a percentage through", () => {
  const offending = [
    "pill: { borderRadius: 999 },",
    "textarea: { minHeight: 120, textAlignVertical: 'top' },",
    "<Pressable hitSlop={8} />",
    "style={{ paddingTop: insets.top + 24 }}",
  ];
  for (const s of offending) assert.ok([...s.matchAll(LENGTH)].length > 0, s);
  const fine = [
    "header: { minHeight: 0, borderRadius: 0 },",
    'short: { width: "60%" },',
    "pressed: { opacity: 0.7 }, elevation: 1, letterSpacing: 0.6, flex: 1,",
    "paddingVertical: t.space.xs / 2, height: t.extent.skeleton,",
  ];
  for (const s of fine) assert.deepEqual([...s.matchAll(LENGTH)], [], s);
});
