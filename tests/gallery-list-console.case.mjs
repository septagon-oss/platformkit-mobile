import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

// The list page draws a list still loading and a list whose page failed. Each
// has no rows, so the list draws its empty region; React reports an error for
// every element it cannot hand its props to, and a served development gallery
// paints that report over the page it is photographed on.
test("list gallery draws its empty lists without a React error at either width", async () => {
  const baseURL = process.env.GALLERY_BASE_URL;
  assert.ok(baseURL, "supply the served gallery origin");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto(`${baseURL}/gallery/list`, { waitUntil: "networkidle" });
      await page.getByTestId("gallery-page:list").waitFor({ state: "visible" });
      await page.waitForTimeout(500);
      assert.deepEqual(errors, [], `the list page at ${width}px logs no React error`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
