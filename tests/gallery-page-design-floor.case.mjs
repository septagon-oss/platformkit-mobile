import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// Use the existing mount-aware gallery measurement and the programme's floor
// rules. Waiting for the page's testID proves reachability without depending on
// the alignment defect, and the gate decides whether the rendered page passes.
for (const page of ["list", "home", "navigate", "form", "steps"]) {
  test(`the mounted ${page} gallery page meets the design floor at both widths`, () => {
    const GALLERY_BASE_URL = process.env.GALLERY_BASE_URL;
    const GALLERY_DESIGN_PROBE = process.env.GALLERY_DESIGN_PROBE;
    const GALLERY_DESIGN_GATE = process.env.GALLERY_DESIGN_GATE;
    assert.ok(GALLERY_BASE_URL, "supply the served gallery origin");
    assert.ok(GALLERY_DESIGN_PROBE, "supply the existing mount-aware gallery measurement");
    assert.ok(GALLERY_DESIGN_GATE, "supply the programme's design gate");
    const measured = spawnSync(
      process.execPath,
      [GALLERY_DESIGN_PROBE, `${GALLERY_BASE_URL}/gallery/${page}`, "390", "1440"],
      { encoding: "utf8", timeout: 90000 },
    );
    assert.ifError(measured.error);
    assert.equal(measured.status, 0, measured.stderr);
    const records = measured.stdout.split("\n").filter((line) => line.startsWith("{"));
    assert.deepEqual(records.map((line) => JSON.parse(line).width), [390, 1440]);
    const directory = mkdtempSync(join(tmpdir(), "gallery-floor-"));
    try {
      const file = join(directory, "measurements.jsonl");
      writeFileSync(file, records.join("\n") + "\n");
      const result = spawnSync("python3", [GALLERY_DESIGN_GATE, "--rules", file, "--report"], {
        encoding: "utf8",
        timeout: 30000,
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
