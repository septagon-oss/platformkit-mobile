// Hermes, the engine the Android app runs, implements Intl.Collator, DateTimeFormat and NumberFormat only. A screen
// that constructs any other Intl class crashes on Android while every Node test passes (2026-10-09: RelativeTimeFormat
// crashed every record screen). The one place allowed to reach such a class is a helper that checks it exists first.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MISSING =
  /\bIntl\.(RelativeTimeFormat|PluralRules|ListFormat|Segmenter|DisplayNames|DurationFormat)\b/;
const GUARDED = new Set(["src/core/presentation.ts"]); // relativeWords: typeof check, then the kit's words

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test("no screen constructs an Intl class Hermes does not have", () => {
  const offenders = [...files("src"), ...files("app")]
    .filter((path) => !GUARDED.has(path))
    .flatMap((path) =>
      readFileSync(path, "utf8")
        .split("\n")
        .map((line, i) => ({ line, at: `${path}:${i + 1}` }))
        .filter(({ line }) => MISSING.test(line) && !/^\s*(\/\/|\*)/.test(line))
        .map(({ at, line }) => `${at}: ${line.trim()}`),
    );
  assert.deepEqual(offenders, []);
});
