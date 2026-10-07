import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const families = [
  "cover-media-card",
  "list-row",
  "data-table",
  "bottom-sheet",
  "drawer",
  "dialog",
  "tab-bar",
  "side-navigation",
  "search-field",
  "filter-chips",
  "form-field-error",
  "stepper",
  "empty-state",
  "toast",
  "progress",
  "mini-player",
] as const;

test("each shared phone pattern has a visual reference", () => {
  const manifest = JSON.parse(readFileSync("design/references/refs.json", "utf8")) as {
    entries: readonly { component: string }[];
  };
  const chosen = new Set(manifest.entries.map((entry) => entry.component));
  const missing = families.filter((family) => !chosen.has(family));
  assert.deepEqual(missing, []);
});
