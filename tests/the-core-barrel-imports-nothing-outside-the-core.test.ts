// src/core is plain functions: it takes a locale, a zone, an instant and a
// catalogue document, and returns what a screen draws. React, an organism, a
// transport and the shell belong to layers above it, and the import direction that
// keeps them out is one ESLint entry over `src/core/**`. That entry is replaced,
// not extended, by any entry that names a core file more narrowly — a
// layer-specific rule overwrites `no-restricted-imports` rather than adding to it —
// so an exemption written for one rule (the kit's gallery fixtures) has to carry the
// layer's own patterns with it, or the file it names stops belonging to the layer.
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { ESLint } from "eslint";

const root = path.resolve(import.meta.dirname, "..");
const eslint = new ESLint({ cwd: root });

async function boundaries(file: string, source: string) {
  const [result] = await eslint.lintText(source, { filePath: path.join(root, file) });
  assert.ok(result);
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
  return result.messages.filter((message) =>
    /no-restricted-(?:imports|syntax|globals)/.test(message.ruleId ?? ""),
  );
}

const outside = [
  'export { Button } from "../ui/atoms/Button";',
  'export { ResourceList } from "../ui/organisms/ResourceList";',
  'export { api } from "../effects/api";',
  'export { Shell } from "../shell";',
  'export { useRoute } from "expo-router";',
  'export { useState } from "react";',
];

test("every file under src/core, the deprecated barrel and the gallery pages included, imports nothing outside the core", async () => {
  for (const file of [
    "src/core/derive.ts",
    "src/core/galleryPages.ts",
    "src/core/activity.ts",
    "src/core/list/index.ts",
    "src/core/present/index.ts",
  ]) {
    for (const source of outside) {
      assert.ok(
        (await boundaries(file, source)).length > 0,
        `${file} may import ${source}: the core layer reaches above itself`,
      );
    }
  }
});

test("a core file that may read the kit's gallery fixtures still may not read a door's part file", async () => {
  // The exemption is for the fixtures alone: kitGallery, kitScenes, stateGallery and
  // galleryPages are what src/ui/gallery.tsx draws, and the barrel publishes them for
  // the compatibility window. It buys nothing else — a door's part files stay private.
  assert.deepEqual(
    await boundaries("src/core/derive.ts", 'export { kitExamples } from "./kitGallery";'),
    [],
  );
  assert.ok(
    (await boundaries("src/core/derive.ts", 'export { listRow } from "./list/rows";')).length > 0,
    "the fixture exemption would otherwise reach inside a door too",
  );
});
