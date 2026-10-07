// Recaptures the photographs design/references/refs.json vouches for: one picture
// per chosen reference screen, of the kit's own specimen for that pattern, at the
// width a phone renders at. Run it against a served gallery:
//
//   GALLERY_BASE_URL=http://127.0.0.1:8898 \
//   PLAYWRIGHT_MODULE=/usr/lib/node_modules/playwright \
//   CAPTURE_WRITE=1 node --test tests/references-capture.case.mjs
//
// A row names its specimen in ours_case — a case the gallery's picker offers, or a
// block of its primitives board, which is gallery-block:<family>-<block> — and a
// surface a person opens says so with ours_open, because a closed dialog is not a
// picture of a dialog. A row refuses rather than photographing when the screen that
// came back is neither a specimen nor a block: a picture of a notice would vouch for
// nothing. CAPTURE_WRITE=1 puts each picture's own sha256 and byte count back into the row,
// so the record and the pixels cannot drift apart.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const MANIFEST = path.join("design", "references", "refs.json");
const WRITES = process.env.CAPTURE_WRITE === "1";

test("every reference row photographs the specimen it names", async () => {
  const baseURL = process.env.GALLERY_BASE_URL;
  assert.ok(baseURL, "supply the served gallery origin");
  const file = path.resolve(MANIFEST);
  const text = readFileSync(file, "utf8");
  const manifest = JSON.parse(text);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const recorded = [];
  try {
    for (const entry of manifest.entries) {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        reducedMotion: "reduce",
      });
      try {
        await page.goto(`${baseURL}/gallery?case=${encodeURIComponent(entry.ours_case)}`, {
          waitUntil: "networkidle",
        });
        await page.getByTestId("gallery").waitFor({ state: "visible" });
        // A block of the primitives board is photographed on its own; every other
        // specimen has the screen to itself, and the screen is the picture.
        const block = entry.ours_block
          ? page.getByTestId(`gallery-block:${entry.ours_block}`)
          : undefined;
        const specimen = ["gallery-kit", "gallery-state", "gallery-spinner"].map((id) =>
          page.getByTestId(id),
        );
        const drawn = block
          ? (await block.count()) > 0
          : (await Promise.all(specimen.map((one) => one.count()))).some((n) => n > 0);
        assert.ok(drawn, `${entry.id}: ${entry.ours_case} drew no specimen to photograph`);
        if (entry.ours_open) {
          await page.getByTestId("gallery-confirm-open").click();
          await page.getByTestId("gallery-confirm").waitFor({ state: "visible" });
        }
        const shot = await (block ?? page).screenshot({ type: "png" });
        writeFileSync(path.join(path.dirname(file), entry.ours_file), shot);
        recorded.push({
          id: entry.id,
          file: entry.ours_file,
          sha256: createHash("sha256").update(shot).digest("hex"),
          bytes: shot.length,
        });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  assert.equal(recorded.length, manifest.entries.length, "a row went unphotographed");
  if (WRITES) {
    // Two fields per row, replaced where they sit, so the record keeps the shape it
    // was committed in instead of being re-emitted by a JSON printer.
    let rewritten = text;
    for (const row of recorded) {
      const at = rewritten.indexOf(`"ours_file": "${row.file}"`);
      assert.ok(at >= 0, `${row.id}: no row to write back into`);
      const from = rewritten.indexOf('"sha256"', at);
      const to = rewritten.indexOf("}", at);
      assert.ok(from > at && from < to, `${row.id}: no sha256 to write back into`);
      // "bytes" is the last field of a row, so it is written without a comma.
      rewritten =
        rewritten.slice(0, from) +
        `"sha256": "${row.sha256}",\n      "bytes": ${row.bytes}\n    ` +
        rewritten.slice(to);
    }
    writeFileSync(file, rewritten);
  }
  console.log(recorded.map((row) => `${row.id} ${row.file} ${row.sha256}`).join("\n"));
});
