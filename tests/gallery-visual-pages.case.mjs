import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
// Reuse the existing verdict rule; capture coverage must not replace that bar.
import "./gallery-visual-verdict.case.mjs";

test("the visual acceptance run captures every gallery page at both required widths", () => {
  const reports = JSON.parse(process.env.GALLERY_VISUAL_REPORTS ?? "[]");
  assert.ok(reports.length > 0, "supply the fresh visual report paths");
  const pages = [
    "list",
    "table",
    "media",
    "home",
    "sheet",
    "navigate",
    "search",
    "form",
    "steps",
    "states",
    "player",
    "commerce",
    "schedule",
    "maps",
    "charts",
  ];
  for (const page of pages) {
    for (const [width, height] of [
      [390, 844],
      [1440, 900],
    ]) {
      const name = `visual-kit-gallery-${page}-${width}.png`;
      let bytes;
      for (const report of reports) {
        try {
          bytes = readFileSync(path.join(path.dirname(report), name));
          break;
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      assert.ok(bytes, `the judge run must include ${name}`);
      assert.equal(bytes.readUInt32BE(16), width, name);
      assert.equal(bytes.readUInt32BE(20), height, name);
    }
  }
});
