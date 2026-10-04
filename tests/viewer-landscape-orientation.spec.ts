// Run against the exported Gallery, with its real Zoom Toolkit adapter.
// This is browser layout evidence; it does not assert native-device behavior.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

test("selected media stays visible when a small phone rotates to landscape", async () => {
  assert.ok(process.env.REVIEW_GALLERY_URL, "supply the locally served Gallery URL");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 320, height: 568 },
      reducedMotion: "reduce",
    });
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", (error: Error) => errors.push(String(error)));
    await page.goto(process.env.REVIEW_GALLERY_URL, { waitUntil: "networkidle" });
    await page.getByTestId("gallery-language").locator("select").selectOption("en");
    await page.getByTestId("gallery-case").locator("select").selectOption("photo-viewer/middle");
    const close = page.getByRole("button", { name: "Close", exact: true });
    const media = page.getByText("Landscape shape", { exact: true });
    await close.waitFor();
    await media.waitFor({ state: "visible" });
    const portrait = await media.boundingBox();
    assert.ok(portrait && portrait.width > 0 && portrait.height > 0);

    await page.setViewportSize({ width: 568, height: 320 });
    // Reach the assertion through the same selected item and the independent Close control.
    // Do not require the zero-size failure as a prerequisite for this test to pass.
    await close.waitFor();
    await media.waitFor({ state: "attached" });
    await page
      .waitForFunction(
        () => {
          const text = Array.from(document.querySelectorAll("div")).find(
            (element) =>
              element.childElementCount === 0 && element.textContent === "Landscape shape",
          );
          const box = text?.getBoundingClientRect();
          return box && box.width > 0 && box.height > 0;
        },
        undefined,
        { timeout: 3000 },
      )
      .catch(() => undefined);
    const landscape = await media.boundingBox();
    console.log("Selected media after rotation:", { portrait, landscape });
    assert.deepEqual(errors, [], "the Gallery must not crash while rotating");
    assert.ok(
      landscape && landscape.width > 0 && landscape.height > 0,
      "selected ready media must remain visible at 568 x 320; controls must leave room for it",
    );
  } finally {
    await browser.close();
  }
});
