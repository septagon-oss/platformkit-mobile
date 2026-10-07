import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE ?? "playwright",
);

test("the player progress track spans the card content at both gallery widths", async () => {
  assert.ok(process.env.GALLERY_BASE_URL, "supply the served gallery origin");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.goto(`${process.env.GALLERY_BASE_URL}/gallery/player`, {
        waitUntil: "networkidle",
      });
      await page.getByTestId("gallery-page:player").waitFor({ state: "visible" });
      const track = page.getByTestId("kit-player-track").first();
      const bounds = await track.evaluate((element) => {
        const card = element.closest('[data-testid="gallery-player"]');
        if (!card) throw new Error("the progress track belongs to the player specimen");
        const style = getComputedStyle(card);
        const rect = card.getBoundingClientRect();
        const trackRect = element.getBoundingClientRect();
        return {
          expectedLeft: rect.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
          expectedRight: rect.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
          left: trackRect.left,
          right: trackRect.right,
        };
      });
      assert.ok(bounds.right > bounds.left, "the track has visible width");
      assert.ok(Math.abs(bounds.left - bounds.expectedLeft) < 1, JSON.stringify({ width, ...bounds }));
      assert.ok(Math.abs(bounds.right - bounds.expectedRight) < 1, JSON.stringify({ width, ...bounds }));
      console.log(JSON.stringify({ width, ...bounds }));
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
