import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

test("selection controls visibly distinguish unchecked and checked states", async () => {
  assert.ok(process.env.GALLERY_BASE_URL, "supply the served gallery origin");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await page.goto(`${process.env.GALLERY_BASE_URL}/gallery?case=selection-control/off`, {
      waitUntil: "networkidle",
    });
    const chooser = page.getByTestId("gallery-case").locator("select");
    await chooser.waitFor({ state: "visible" });
    const captures = [];
    for (const [state, checked] of [["off", "false"], ["on", "true"]]) {
      await chooser.selectOption(`selection-control/${state}`);
      const checkbox = page.getByRole("checkbox");
      await checkbox.waitFor({ state: "visible" });
      assert.equal(await checkbox.getAttribute("aria-checked"), checked);
      await page.mouse.move(0, 0);
      const pixels = await checkbox.screenshot({ animations: "disabled" });
      captures.push({ state, hash: createHash("sha256").update(pixels).digest("hex") });
    }
    console.log(JSON.stringify(captures));
    assert.equal(
      new Set(captures.map(({ hash }) => hash)).size,
      2,
      "checking a selection needs a visible distinction, not only aria-checked",
    );
  } finally {
    await browser.close();
  }
});
