// The gallery's page journey reaches its named specimen and keeps an unknown
// page's refusal on that route. This browser pin does not prove native links.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

test("a gallery page reveals its states and an unknown page refuses without signing in", async () => {
  assert.ok(process.env.GALLERY_BASE_URL, "supply the served gallery origin");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${process.env.GALLERY_BASE_URL}/gallery/table`, {
      waitUntil: "networkidle",
    });
    await page.getByText("Table", { exact: true }).waitFor();
    await page.getByTestId("gallery-page-later-states").click();
    const quantity = page.getByText("Quantity control", { exact: true });
    await quantity.scrollIntoViewIfNeeded();
    assert.equal(await quantity.isVisible(), true);
    await page.goto(`${process.env.GALLERY_BASE_URL}/gallery/notebook`, {
      waitUntil: "networkidle",
    });
    await page.getByText("This information is not valid.", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/gallery/notebook");
    assert.equal(await page.getByTestId("sign-in").count(), 0);
  } finally {
    await browser.close();
  }
});
