import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

for (const width of [390, 1440]) {
  test(`the player's ready artwork has a drawable canvas at ${width}px`, async () => {
    assert.ok(process.env.GALLERY_BASE_URL, "supply the served gallery origin");
    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    try {
      const page = await browser.newPage({
        viewport: { width, height: width === 390 ? 844 : 900 },
        reducedMotion: "reduce",
      });
      await page.goto(`${process.env.GALLERY_BASE_URL}/gallery/player`, {
        waitUntil: "networkidle",
      });
      await page.getByTestId("gallery-page:player").waitFor({ state: "visible" });
      const artworks = page.getByTestId("gallery-player-art");
      assert.ok(await artworks.count(), "the player supplies its artwork slot");
      for (const artwork of await artworks.all()) {
        const poster = artwork.locator('[data-testid^="poster:"]');
        await poster.waitFor({ state: "visible" });
        const bounds = await poster.evaluate((element) => {
          const field = element.firstElementChild;
          const size = (node) => {
            const rect = node.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          };
          return {
            poster: size(element),
            field: field ? size(field) : undefined,
            marks: field ? Array.from(field.children, size) : [],
          };
        });
        console.log(JSON.stringify({ viewport: width, ...bounds }));
        assert.ok(bounds.poster.width > 0 && bounds.poster.height > 0);
        assert.ok(bounds.field, "the poster supplies a drawing canvas");
        assert.ok(bounds.marks.length > 0, "the supplied artwork has marks to draw");
        assert.ok(
          bounds.field.width > 0 && bounds.field.height > 0,
          "ready artwork must have a positive drawing area inside its visible frame",
        );
        assert.ok(
          bounds.marks.every((mark) => mark.width > 0 && mark.height > 0),
          "the supplied artwork's marks must be visible within the canvas",
        );
      }
    } finally {
      await browser.close();
    }
  });
}
