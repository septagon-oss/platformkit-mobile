import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

for (const pageId of ["home", "form"]) {
  test(`${pageId} gallery aligns desktop headings and body copy to two edges`, async () => {
    const baseURL = process.env.GALLERY_BASE_URL;
    assert.ok(baseURL, "supply the served gallery origin");
    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(`${baseURL}/gallery/${pageId}`, { waitUntil: "networkidle" });
      await page.getByTestId(`gallery-page:${pageId}`).waitFor({ state: "visible" });
      const edges = await page.evaluate(() => {
        const positions = [...document.querySelectorAll("h1,h2,h3,p")]
          .filter((element) => {
            const bounds = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return (
              bounds.width > 40 &&
              bounds.height > 6 &&
              style.visibility !== "hidden" &&
              style.display !== "none"
            );
          })
          .map((element) => Math.round(element.getBoundingClientRect().left))
          .sort((a, b) => a - b);
        return positions.filter((left, index) => index === 0 || left - positions[index - 1] > 3);
      });
      assert.ok(edges.length <= 2, `${pageId}: ${edges.length} left edges ${edges}`);
    } finally {
      await browser.close();
    }
  });
}
