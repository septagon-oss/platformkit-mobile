import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

test("the search field exposes an editable searchbox instead of a landmark", async () => {
  assert.ok(process.env.GALLERY_BASE_URL, "supply the served gallery origin");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${process.env.GALLERY_BASE_URL}/gallery?case=search-field/query`, {
      waitUntil: "networkidle",
    });
    // Reach the field through its native element, independently of its ARIA role.
    const field = page.getByTestId("gallery-search").locator("input");
    await field.waitFor({ state: "visible" });
    const query = await field.inputValue();
    assert.ok(query.length > 0, "the query specimen contains a query");
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    const editable = nodes.find(
      (node) => !node.ignored && node.value?.value === query,
    );
    assert.ok(editable, "the field's value is present in the accessibility tree");
    assert.equal(editable.role?.value, "searchbox");
  } finally {
    await browser.close();
  }
});
