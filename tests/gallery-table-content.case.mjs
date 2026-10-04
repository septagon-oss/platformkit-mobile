import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

test("table gallery presents populated columns and rows on a desktop", async () => {
  const baseURL = process.env.GALLERY_BASE_URL;
  assert.ok(baseURL, "supply the served gallery origin");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseURL}/gallery/table`, { waitUntil: "networkidle" });
    await page.getByTestId("gallery-page:table").waitFor({ state: "visible" });
    assert.ok((await page.getByRole("columnheader").count()) >= 2, "the table needs two columns");
    assert.ok((await page.getByRole("row").count()) >= 3, "the table needs populated rows");
  } finally {
    await browser.close();
  }
});
