// The Markdown face brings markdown-it and linkify-it into the lockfile, and both carry
// high advisories the registry has published with no release this face can take
// (react-native-markdown-display pins markdown-it ^10). The repository's rule
// (scripts/advisories.ts, run blocking in CI) is that a high filing is either fixed by
// the version held or reviewed by name and version in advisories.json. This case asks
// that question of the two packages this face alone adds, from the two files in the
// checkout and nothing on the network, so a lockfile that holds them unreviewed is
// refused here as CI refuses it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

interface Lock {
  readonly packages: Record<string, { readonly version: string }>;
}
interface Record_ {
  readonly reviews: readonly { readonly package: string; readonly versions: readonly string[] }[];
}

/** faceDependencies are the packages only the Markdown face brings, with the first release that answers every high filing the audit names against them. */
const faceDependencies = {
  "markdown-it": "14.3.1",
  "linkify-it": "5.0.2",
} as const;

const parse = (v: string): number[] => v.split(".").map((part) => Number.parseInt(part, 10));
const atLeast = (held: string, fixed: string): boolean => {
  const a = parse(held),
    b = parse(fixed);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
};

test("every package the Markdown face adds is fixed or reviewed by name and version", () => {
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as Lock;
  const record = JSON.parse(readFileSync("advisories.json", "utf8")) as Record_;
  const unanswered: string[] = [];
  for (const [name, fixed] of Object.entries(faceDependencies)) {
    const held = lock.packages[`node_modules/${name}`]?.version;
    if (held === undefined || atLeast(held, fixed)) continue;
    const reviewed = record.reviews.some(
      (review) => review.package === name && review.versions.includes(held),
    );
    if (!reviewed) unanswered.push(`${name}@${held}`);
  }
  assert.deepEqual(unanswered, []);
});
