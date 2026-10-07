import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
// Keep the kit's verdict and capture rules authoritative; also refuse old evidence.
import "./gallery-visual-pages.case.mjs";

test("gallery visual evidence postdates the source revision being judged", () => {
  const reports = JSON.parse(process.env.GALLERY_VISUAL_REPORTS ?? "[]");
  assert.ok(reports.length > 0, "supply the fresh visual report paths");
  const sourceTime = Number(
    execFileSync("git", ["show", "-s", "--format=%ct", "HEAD"], { encoding: "utf8" }).trim(),
  ) * 1000;
  for (const file of reports) {
    const report = readFileSync(file, "utf8");
    const timestamp = report.match(/^# Visual review .* — (\d{4}-\d{2}-\d{2}T[^\s]+)$/m)?.[1];
    assert.ok(timestamp, `${file}: the gate records when it ran`);
    assert.ok(Date.parse(timestamp) >= sourceTime, `${file}: recapture after this source revision`);
  }
});
